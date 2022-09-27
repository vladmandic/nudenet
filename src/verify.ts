/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

const video = document.getElementById('video') as HTMLVideoElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

let stop = false;

async function verifyFrame(_timestamp: DOMHighResTimeStamp, metadata: VideoFrameMetadata) {
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  const videoTensor = await tf.browser.fromPixelsAsync(video);
  const canvasTensor = await tf.browser.fromPixelsAsync(canvas);
  const videoData = await videoTensor.data();
  const canvasData = await canvasTensor.data();
  let errors = 0;
  for (let i = 0; i < videoData.length; i++) {
    if (videoData[i] < 0 || videoData[i] > 255 || !Number.isSafeInteger(videoData[i])) errors++;
  }
  if (errors > 0) console.log({ mediaTime: metadata.mediaTime, errors, videoData, canvasData }); // uncomment to see pixel values
  tf.dispose([videoTensor, canvasTensor]);
  video.requestVideoFrameCallback(verifyFrame); // callback when frame change
  if (!stop) video.currentTime += 1 / 60; // hack to move video frame-by-frame intead of playing it
}

async function main() {
  await tf.setBackend('webgpu');
  await tf.ready();
  console.log({ tf: tf.version_core, backend: tf.getBackend(), available: tf.engine().registryFactory, flags: tf.env().getFlags() });
  video.src = '../samples/f1.webm';
  video.onclick = () => stop = true;
  video.requestVideoFrameCallback(verifyFrame); // starts processing when first frame is displayed
}

window.onload = main;
