const fs = require('fs');
const log = require('@vladmandic/pilogger');
const tf = require('@tensorflow/tfjs-node');
const canvas = require('canvas');

// app options
const debug = true;

// image options
const image = {
  save: true,
  saveSize: 0, // set to 0 to avoid image resizing
  blurNude: true,
  blurRadius: 25,
};

// model options
const options = {
  minScore: 0.30,
  maxResults: 50,
  iouThreshold: 0.5,
};

// model classes
const labels = {
  0: { id: 0, displayName: 'exposed anus' },
  1: { id: 1, displayName: 'exposed armpits' },
  2: { id: 2, displayName: 'belly' },
  3: { id: 3, displayName: 'exposed belly' },
  4: { id: 4, displayName: 'buttocks' },
  5: { id: 5, displayName: 'exposed buttocks' },
  6: { id: 6, displayName: 'female' },
  7: { id: 7, displayName: 'male' },
  8: { id: 8, displayName: 'feet' },
  9: { id: 9, displayName: 'exposed feet' },
  10: { id: 10, displayName: 'breast' },
  11: { id: 11, displayName: 'exposed breast' },
  12: { id: 12, displayName: 'vagina' },
  13: { id: 13, displayName: 'exposed vagina' },
  14: { id: 14, displayName: 'male breast' },
  15: { id: 15, displayName: 'exposed male breast' },
};

// custom landmark definitions of what is a person, sexy, nude
const labelPerson = [6, 7];
const labelSexy = [1, 2, 3, 4, 8, 9, 10, 15];
const labelNude = [0, 5, 11, 12, 13];

const models = [];

// draw rect with rounded corners
function rect({ drawCanvas = null, x = 0, y = 0, width = 0, height = 0, radius = 8, lineWidth = 2, color = 'white', title = null, font = '16px "Segoe UI"' }) {
  const ctx = drawCanvas.getContext('2d');
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
  if (title) ctx.fillText(title, x + 4, y - 4);
}

// blur par of canvas by redrawing it with smaller resulution
function blur({ drawCanvas = null, left = 0, top = 0, width = 0, height = 0 }) {
  const blurCanvas = new canvas.Canvas(width / image.blurRadius, height / image.blurRadius);
  const blurCtx = blurCanvas.getContext('2d');
  blurCtx.imageSmoothingEnabled = true;
  blurCtx.drawImage(drawCanvas, left, top, width, height, 0, 0, width / image.blurRadius, height / image.blurRadius);
  const canvasCtx = drawCanvas.getContext('2d');
  canvasCtx.drawImage(blurCanvas, left, top, width, height);
}

// read image file and prepare tensor for further processing
function getTensorFromImage(imageFile) {
  if (!fs.existsSync(imageFile)) {
    log.error('Not found:', imageFile);
    return null;
  }
  const data = fs.readFileSync(imageFile);
  const bufferT = tf.node.decodeImage(data);
  const expandedT = tf.expandDims(bufferT, 0);
  const imageT = tf.cast(expandedT, 'float32');
  // @ts-ignore
  imageT.file = imageFile;
  tf.dispose(expandedT);
  tf.dispose(bufferT);
  // @ts-ignore
  if (debug) log.info('Image:', imageT.file, 'width:', imageT.shape[2], 'height:', imageT.shape[1]);
  return imageT;
}

// create output jpeg after processing
async function saveProcessedImage(inImage, outImage, data) {
  if (!data) return false;
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve) => {
    // create canvas
    const scale = image.saveSize > 0 ? (data.image.width / image.saveSize) : 1;
    const c = new canvas.Canvas(data.image.width / scale, data.image.height / scale);
    const ctx = c.getContext('2d');
    // load and draw original image
    const original = await canvas.loadImage(inImage);
    ctx.drawImage(original, 0, 0, c.width, c.height);
    // draw all detected objects
    for (const obj of data.detected) {
      if (labelNude.includes(obj.classId) && image.blurNude) blur({ drawCanvas: c, left: obj.bbox.x / scale, top: obj.bbox.y / scale, width: obj.bbox.width / scale, height: obj.bbox.height / scale });
      rect({ drawCanvas: c, x: obj.bbox.x / scale, y: obj.bbox.y / scale, width: obj.bbox.width / scale, height: obj.bbox.height / scale, title: `${Math.round(100 * obj.score)}% ${obj.class}` });
    }
    // write canvas to jpeg
    const out = fs.createWriteStream(outImage);
    out.on('finish', () => {
      if (debug) log.state('Created output image:', outImage);
      resolve(true);
    });
    out.on('error', (err) => {
      log.error('Error creating image:', outImage, err);
      resolve(true);
    });
    const stream = c.createJPEGStream({ quality: 0.6, progressive: true, chromaSubsampling: true });
    stream.pipe(out);
  });
}

// parse prediction data
async function processPrediction(res, imageT) {
  // hack to indetify outputs as converted graph model loose output names so i identify what is what by output type and shape
  const classesT = res.find((a) => a.dtype === 'int32');
  const scoresT = res.find((a) => a.shape.length === 2);
  const boxesT = res.find((a) => a.shape.length === 3);
  const classes = await classesT.data();
  const scores = await scoresT.data();
  const boxes = await boxesT.array();
  // sort & filter results
  const nmsT = await tf.image.nonMaxSuppressionAsync(boxes[0], scores, options.maxResults, options.iouThreshold, options.minScore);
  const nms = await nmsT.data();
  tf.dispose(nmsT);
  const detected = [];
  // create result object
  // eslint-disable-next-line guard-for-in
  for (const i in nms) {
    const id = parseInt(i);
    detected.push({
      score: Math.trunc(10000 * scores[i]) / 10000,
      classId: classes[id],
      // lookup classes
      class: labels[classes[id]]?.displayName,
      // convert box from x0,y0,x1,y1 to x,y,width,heigh
      bbox: {
        x: Math.trunc(boxes[0][id][0]),
        y: Math.trunc(boxes[0][id][1]),
        width: Math.trunc((boxes[0][id][3] - boxes[0][id][1])),
        height: Math.trunc((boxes[0][id][2] - boxes[0][id][0])),
      },
    });
  }
  const obj = { detected };
  obj.image = { file: imageT.file, width: imageT.shape[2], height: imageT.shape[1] };
  // add custom landmarks
  obj.person = detected.filter((a) => labelPerson.includes(a.classId));
  obj.sexy = detected.filter((a) => labelSexy.includes(a.classId));
  obj.nude = detected.filter((a) => labelNude.includes(a.classId));
  if (debug) log.data(obj);
  return obj;
}

// load saved model and run inference
async function processSavedModel(modelPath, inImage, outImage) {
  if (!models[modelPath]) {
    if (debug) log.state('Loading saved model:', modelPath);
    const meta = await tf.node.getMetaGraphsFromSavedModel(modelPath);
    log.data(meta);
    try {
      models[modelPath] = await tf.node.loadSavedModel(modelPath, ['serve'], 'predict');
      models[modelPath].path = modelPath;
    } catch (err) {
      log.error('Error loading graph model:', modelPath, err.message, err.stack);
      return null;
    }
  }
  // get image tensor
  const imageT = getTensorFromImage(inImage);
  // run prediction
  const t0 = process.hrtime.bigint();
  let resT;
  try {
    resT = models[modelPath].predict ? await models[modelPath].predict(imageT) : null;
  } catch (err) {
    log.error('Error executing graph model:', modelPath, err.message);
  }
  const t1 = process.hrtime.bigint();
  // parse outputs
  const res = resT ? await processPrediction(resT, imageT) : [];
  // free up memory
  // @ts-ignore
  tf.dispose(imageT);
  for (const tensorT of resT) tensorT.dispose();
  // save processed image and return result
  await saveProcessedImage(inImage, outImage, res);
  // @ts-ignore
  log.state(`Exec: model:${modelPath} input:${inImage} output:${outImage} objects:`, res.detected?.length, 'in:', Math.trunc(parseInt(t1 - t0) / 1000 / 1000), 'ms');
  return res;
}

// load graph model and run inference
async function processGraphModel(modelPath, inImage, outImage) {
  if (!models[modelPath]) {
    if (debug) log.state('Loading graph model:', modelPath);
    // load model
    try {
      models[modelPath] = await tf.loadGraphModel(modelPath);
      models[modelPath].path = modelPath;
    } catch (err) {
      log.error('Error loading graph model:', modelPath, err.message, err);
      return null;
    }
  }
  // get image tensor
  const imageT = getTensorFromImage(inImage);
  // run prediction
  let resT;
  try {
    resT = models[modelPath].executeAsync ? await models[modelPath].executeAsync(imageT) : null;
  } catch (err) {
    log.error('Error executing graph model:', modelPath, err.message);
  }
  // parse outputs
  const res = resT ? await processPrediction(resT, imageT) : [];
  // free up memory
  // @ts-ignore
  tf.dispose(imageT);
  for (const tensorT of resT) tensorT.dispose();
  // save processed image and return result
  await saveProcessedImage(inImage, outImage, res);
  // @ts-ignore
  log.state(`Exec: model:${modelPath} input:${inImage} output:${outImage} objects:`, res.detected?.length);
  return res;
}

// main function
async function main() {
  log.header();

  if (process.argv.length !== 5) {
    log.error(`Usage: ${process.argv[1]} <saved|graph> <input-image> <output-image>`);
    log.info('To change model and image options, modify objects in header of this file');
    log.info('Fetch saved model: ');
    log.info('  mkdir models/ mkdir models/saved; curl -L https://github.com/notAI-tech/NudeNet/releases/download/v0/detector_v2_default_checkpoint_tf.tar | tar -C models/saved -x');
    log.info('Convert graph model: ');
    log.info('  tensorflowjs_converter --strip_debug_ops=* --control_flow_v2=* --quantize_float16=* models/saved/ models/graph/');
    return;
  }

  await tf.enableProdMode();
  await tf.ENV.set('DEBUG', false);
  await tf.ready();

  if (debug) log.info('TensorFlow/JS Version', tf.version_core);
  if (debug) log.info('TensorFlow/JS Backend', tf.getBackend());
  // @ts-ignore
  if (debug) log.info('TensorFlow/JS Flags', tf.ENV.flags);

  const input = process.argv[3];
  const output = process.argv[4];
  switch (process.argv[2]) {
    // models/saved/nudenet
    case 'saved': await processSavedModel('../model-saved', input, output); break;
    case 'graph': await processGraphModel('file://model-graph/model.json', input, output); break;
    default: log.error('Unrecognized operation type');
  }

  // eslint-disable-next-line guard-for-in
  for (const model in models) tf.dispose(model);
}

main();
