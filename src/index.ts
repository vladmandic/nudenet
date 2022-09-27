import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-backend-webgl'; // eslint-disable-line import/no-extraneous-dependencies
import '@tensorflow/tfjs-backend-webgpu'; // eslint-disable-line import/no-extraneous-dependencies

const video = document.getElementById('video') as HTMLVideoElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const blurCanvas = document.createElement('canvas');
const blurCtx = blurCanvas.getContext('2d') as CanvasRenderingContext2D;
const markRegions = document.getElementById('markregions') as HTMLInputElement;
const blurNude = document.getElementById('blurnude') as HTMLInputElement;
const blurSexy = document.getElementById('blursexy') as HTMLInputElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const t: Record<string, tf.Tensor> = {};
let model;

const log = (msg) => console.log(msg); // eslint-disable-line no-console

const options = { // options
  modelPath: '../model/model.json',
  videoPath: '../samples/video.webm',
  minScore: 0.30,
  maxResults: 50,
  iouThreshold: 0.5,
  outputNodes: ['output1', 'output2', 'output3'],
  blurRadius: 25,
  resolution: [1280, 720] as [number, number],
  // resolution: [320, 180] as [number, number],
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

async function processPrediction(boxesTensor: tf.Tensor, scoresTensor: tf.Tensor, classesTensor: tf.Tensor, inputTensor: tf.Tensor) {
  const boxes = await boxesTensor.array();
  const scores = await scoresTensor.data();
  const classes = await classesTensor.data();
  const nmsT = await tf.image.nonMaxSuppressionAsync(boxes[0], scores, options.maxResults, options.iouThreshold, options.minScore); // sort & filter results
  const nms = await nmsT.data();
  tf.dispose(nmsT);
  const parts: { score: number, id: number, class: string, box: [number, number, number, number] }[] = [];
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
    input: { width: inputTensor.shape[2], height: inputTensor.shape[1] },
    person: parts.filter((a) => composite.person.includes(a.id)).length > 0,
    sexy: parts.filter((a) => composite.sexy.includes(a.id)).length > 0,
    nude: parts.filter((a) => composite.nude.includes(a.id)).length > 0,
    parts,
  };
  return result;
}

function blur({ left = 0, top = 0, width = 0, height = 0 }) {
  if (width === 0 || height === 0 || canvas.width === 0 || canvas.height === 0) return;
  blurCanvas.width = (width / options.blurRadius) + 1;
  blurCanvas.height = (height / options.blurRadius) + 1;
  blurCtx.imageSmoothingEnabled = true;
  blurCtx.drawImage(canvas, left, top, width, height, 0, 0, width / options.blurRadius, height / options.blurRadius);
  ctx.drawImage(blurCanvas, left, top, width, height);
}

function rect({ x = 0, y = 0, width = 0, height = 0, radius = 8, lineWidth = 2, color = 'white', title = '', font = '16px "Segoe UI"' }) {
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(title, x + 4, y - 4);
}

function processParts(res) {
  for (const obj of res.parts) { // draw all detected objects
    if (composite.nude.includes(obj.id) && blurNude.checked) blur({ left: obj.box[0], top: obj.box[1], width: obj.box[2], height: obj.box[3] });
    if (composite.sexy.includes(obj.id) && blurSexy.checked) blur({ left: obj.box[0], top: obj.box[1], width: obj.box[2], height: obj.box[3] });
    if (markRegions.checked) rect({ x: obj.box[0], y: obj.box[1], width: obj.box[2], height: obj.box[3], title: `${Math.round(100 * obj.score)}% ${obj.class}` });
  }
}

let ts = 0;
async function processLoop() {
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
  if (video.currentTime !== ts && canvas.width > 0 && model && video.readyState >= 2) {
    ts = video.currentTime;
    t.buffer = await tf.browser.fromPixelsAsync(video);
    t.resize = (options.resolution[0] > 0 && options.resolution[1] > 0 && (options.resolution[0] !== video.videoWidth || options.resolution[1] !== video.videoHeight)) // do we need to resize
      ? tf.image.resizeNearestNeighbor(t.buffer as tf.Tensor3D, [options.resolution[1], options.resolution[0]])
      : t.buffer;
    t.cast = tf.cast(t.resize, 'float32');
    t.batch = tf.expandDims(t.cast, 0);
    const t0 = Date.now();
    [t.boxes, t.scores, t.classes] = await model.executeAsync(t.batch, options.outputNodes);
    const t1 = Date.now();
    const res = await processPrediction(t.boxes, t.scores, t.classes, t.cast);
    await tf.browser.toPixels(t.resize as tf.Tensor3D, canvas);
    processParts(res);
    log({ ts, time: t1 - t0, res, t });
    Object.keys(t).forEach((tensor) => tf.dispose(t[tensor]));
  }
  requestAnimationFrame(processLoop);
}

async function main() {
  if (tf.engine().registryFactory.webgpu && navigator?.gpu) await tf.setBackend('webgpu');
  else await tf.setBackend('webgl');
  // tf.env().set('WEBGL_USE_SHAPES_UNIFORMS', true); // doubles the performance
  await tf.ready();
  log({ tf: tf.version_core, backend: tf.getBackend(), available: tf.engine().registryFactory, flags: tf.env().getFlags() });
  model = await tf.loadGraphModel(options.modelPath);
  log({ model });
  video.oncanplay = () => log({ video: video.src, width: video.videoWidth, height: video.videoHeight });
  video.src = options.videoPath;
  await processLoop();
}

window.onload = main;
