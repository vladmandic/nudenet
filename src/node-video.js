// const fs = require('fs');
const spawn = require('child_process').spawn;
const Pipe2Jpeg = require('pipe2jpeg');
const log = require('@vladmandic/pilogger');
const tf = require('@tensorflow/tfjs-node-gpu');

const options = { // options
  debug: true,
  modelPath: 'file://model/model.json',
  inputVideo: 'samples/video.webm',
  minScore: 0.30,
  maxResults: 50,
  iouThreshold: 0.5,
  outputNodes: ['output1', 'output2', 'output3'],
  blurNude: true,
  blurRadius: 25,
};

const labels = [ // class labels
  'exposed anus',
  'exposed armpits',
  'belly',
  'exposed belly',
  'buttocks',
  'exposed buttocks',
  'female face',
  'male face',
  'feet',
  'exposed feet',
  'breast',
  'exposed breast',
  'vagina',
  'exposed vagina',
  'male breast',
  'exposed male breast',
];

const composite = { // composite definitions of what is a person, sexy, nude
  person: [6, 7],
  sexy: [1, 2, 3, 4, 8, 9, 10, 15],
  nude: [0, 5, 11, 12, 13],
};

const pipe2jpeg = new Pipe2Jpeg();

const ffmpegParams = [
  '-loglevel', 'quiet',
  // input
  // '-re', // optional process video in real-time not as fast as possible
  '-i', `${options.inputVideo}`, // input file
  // output
  '-an', // drop audio
  '-c:v', 'mjpeg', // use motion jpeg as output encoder
  '-pix_fmt', 'yuvj422p', // typical for mp4, may need different settings for some videos
  '-f', 'image2pipe', // pipe images as output
  // '-vf', 'fps=5,scale=800:600', // optional video filter, do anything here such as process at fixed 5fps or resize to specific resulution
  'pipe:1', // output to unix pipe that is then captured by pipe2jpeg
];

let model; // holds instance of graph model

// parse prediction data
async function processPrediction(boxesTensor, scoresTensor, classesTensor) {
  const boxes = await boxesTensor.array();
  const scores = await scoresTensor.data();
  const classes = await classesTensor.data();
  const nmsT = await tf.image.nonMaxSuppressionAsync(boxes[0], scores, options.maxResults, options.iouThreshold, options.minScore); // sort & filter results
  const nms = await nmsT.data();
  tf.dispose(nmsT);
  const parts = [];
  for (const i in nms) { // create body parts object
    const id = parseInt(i);
    parts.push({
      score: scores[i],
      id: classes[id],
      class: labels[classes[id]], // lookup classes
      box: [ // convert box from x0,y0,x1,y1 to x,y,width,heigh
        Math.trunc(boxes[0][id][0]),
        Math.trunc(boxes[0][id][1]),
        Math.trunc((boxes[0][id][3] - boxes[0][id][1])),
        Math.trunc((boxes[0][id][2] - boxes[0][id][0])),
      ],
    });
  }
  const result = {
    person: parts.filter((a) => composite.person.includes(a.id)).length > 0,
    sexy: parts.filter((a) => composite.sexy.includes(a.id)).length > 0,
    nude: parts.filter((a) => composite.nude.includes(a.id)).length > 0,
    parts,
  };
  return result;
}

/*
function analyzeProfile(profile) {
  fs.writeFileSync('profile.json', JSON.stringify(profile, null, 2));
  const kernels = {};
  let total = 0;
  for (const kernel of profile.kernels) { // sum kernel time values per kernel
    if (kernels[kernel.name]) kernels[kernel.name] += kernel.kernelTimeMs;
    else kernels[kernel.name] = kernel.kernelTimeMs;
    total += kernel.kernelTimeMs;
  }
  const kernelArr = [];
  Object.entries(kernels).forEach((key) => kernelArr.push({ kernel: key[0], time: key[1], perc: 0 })); // convert to array
  for (const kernel of kernelArr) {
    kernel.perc = Math.round(1000 * kernel.time / total) / 1000;
    kernel.time = Math.round(1000 * kernel.time) / 1000;
  }
  kernelArr.sort((a, b) => b.time - a.time); // sort
  kernelArr.length = 20; // crop
  log.data(kernelArr);
}
*/

// load graph model and run inference
let frame = 0;
async function runDetection(jpegBuffer) {
  frame++;
  const t = {};
  t.buffer = tf.node.decodeJpeg(jpegBuffer, 3); // decode jpeg buffer to raw tensor
  t.cast = tf.cast(t.buffer, 'float32');
  t.input = tf.expandDims(t.cast, 0);
  const t0 = process.hrtime.bigint();

  // const profile = await tf.profile(async () => [t.boxes, t.scores, t.classes] = await model.executeAsync(t.input, options.outputNodes)); // run prediction
  // analyzeProfile(profile);

  [t.boxes, t.scores, t.classes] = await model.executeAsync(t.input, options.outputNodes); // run prediction
  const t1 = process.hrtime.bigint();
  const res = await processPrediction(t.boxes, t.scores, t.classes); // parse outputs
  Object.keys(t).forEach((tensor) => tf.dispose(t[tensor])); // free up memory
  log.data({ frame, time: (t1 - t0) / 1000n / 1000n, parts: res.parts?.length, sexy: res.sexy, nude: res.nude });
  return res;
}

// main function
async function main() {
  log.header();
  await tf.ready();
  if (options.debug) log.info('tfjs version:', tf.version_core, 'backend:', tf.getBackend());
  if (options.debug) log.info('options:', options);
  model = await tf.loadGraphModel(options.modelPath);

  pipe2jpeg.on('data', (jpegBuffer) => runDetection(jpegBuffer));
  const ffmpeg = spawn('ffmpeg', ffmpegParams, { stdio: ['ignore', 'pipe', 'ignore'] });
  ffmpeg.on('error', (error) => log.error('ffmpeg error:', error));
  ffmpeg.on('exit', (code, signal) => log.info('ffmpeg exit', code, signal));
  ffmpeg.stdout.pipe(pipe2jpeg);
}

main();
