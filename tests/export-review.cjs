/*
 * Pixel-level regression checks for the production canvas compositor.
 * A decoded source canvas replaces an HTML media element; the production
 * render/mediaSurface/animation/text/shape functions execute unchanged.
 * This deliberately does not claim to exercise a browser MediaRecorder.
 * VIDEO_SOURCE can point to an older video.html to demonstrate the regression.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let canvasLibrary;
try { canvasLibrary = require('@napi-rs/canvas'); }
catch (error) {
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
  canvasLibrary = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, '@napi-rs/canvas'));
}
const { createCanvas } = canvasLibrary;
const source = fs.readFileSync(process.env.VIDEO_SOURCE || path.join(__dirname, '../tools/video.html'), 'utf8');
const first = source.indexOf('function animated(c, t) {');
const last = source.indexOf('function syncMedia(', first);
assert(first >= 0 && last > first, 'production compositor can be located');
const compositor = source.slice(first, last);
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const value = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const live = (clip, time) => time >= clip.start - 0.00001 && time < clip.start + clip.duration - 0.00001;
const project = { width: 1280, height: 720, bg: '#000000', bgMode: 'color', tracks: [{ id: 'video' }], clips: [] };
const app = { project, time: 0, canvas: createCanvas(640, 360) };
const decoded = createCanvas(1280, 720);
decoded.naturalWidth = decoded.width;
decoded.naturalHeight = decoded.height;
const decodedContext = decoded.getContext('2d');
// One-pixel bars must survive when native source pixels map 1:1 to output.
// Prematurely reducing to the unzoomed fit size averages them into grey.
decodedContext.fillStyle = '#ffffff';
decodedContext.fillRect(0, 0, decoded.width, decoded.height);
decodedContext.fillStyle = '#000000';
for (let x = 0; x < decoded.width; x += 2) decodedContext.fillRect(x, 0, 1, decoded.height);
const resource = { el: decoded, ready: true, type: 'image', canvas: createCanvas(1, 1) };
const context = { app, value, clamp, live, prune() {}, resource: () => resource, track: () => project.tracks[0] };
vm.createContext(context);
vm.runInContext(compositor + '\nthis.productionRender = render;', context);
function pixels(canvas) { return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; }
function difference(actual, expected) {
  assert.equal(actual.length, expected.length);
  let error = 0, contrast = 0, count = 0;
  for (let y = 8; y < app.canvas.height - 8; y++) {
    for (let x = 8; x < app.canvas.width - 8; x++) {
      const i = (y * app.canvas.width + x) * 4;
      error += Math.abs(actual[i] - expected[i]);
      contrast += Math.abs(actual[i] - actual[i + 4]);
      count++;
    }
  }
  return { meanAbsoluteError: error / count, adjacentPixelContrast: contrast / count };
}
const imageClip = { id: 'image', type: 'image', mediaId: 'synthetic-decoded-source', trackId: 'video', start: 0, duration: 3, scale: 2, opacity: 1, fit: 'contain' };
project.clips = [imageClip];
const reference = createCanvas(640, 360);
reference.getContext('2d').drawImage(decoded, -320, -180, 1280, 720);
context.productionRender(0);
const nativeZoom = difference(pixels(app.canvas), pixels(reference));
assert(nativeZoom.meanAbsoluteError <= 2, `native-detail zoom must match direct source sampling; MAE=${nativeZoom.meanAbsoluteError.toFixed(2)}`);
assert(nativeZoom.adjacentPixelContrast >= 240, `zoom must preserve native one-pixel detail; contrast=${nativeZoom.adjacentPixelContrast.toFixed(2)}`);

// The effective animated scale must determine sampling, not just c.scale.
imageClip.scale = 1;
imageClip.keys = [{ time: 0, scale: 1 }, { time: 2, scale: 3 }];
context.productionRender(1);
const animatedZoom = difference(pixels(app.canvas), pixels(reference));
assert(animatedZoom.meanAbsoluteError <= 2, `animated zoom must retain native detail; MAE=${animatedZoom.meanAbsoluteError.toFixed(2)}`);

// Output-resolution changes must preserve project geometry. The same 180px
// square must occupy 90px at half resolution and 180px at project resolution.
project.clips = [{ id: 'shape', type: 'shape', trackId: 'video', start: 0, duration: 3, shape: 'square', shapeSize: 180, color: '#ffffff', x: 10, y: -10, scale: 1, opacity: 1 }];
function whiteBounds(canvas) {
  const data = pixels(canvas);
  let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4;
    if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
context.productionRender(0);
assert.deepEqual(whiteBounds(app.canvas), { x: 339, y: 99, width: 90, height: 90 });
app.canvas.width = 1280; app.canvas.height = 720;
context.productionRender(0);
assert.deepEqual(whiteBounds(app.canvas), { x: 678, y: 198, width: 180, height: 180 });

// Titles must be rasterized at each requested output resolution instead of
// upscaling a preview-sized bitmap. Their layout remains proportional.
project.clips = [{ id: 'title', type: 'text', trackId: 'video', start: 0, duration: 3, text: 'EXPORT DETAIL', fontSize: 60, fontFamily: 'Arial', bold: true, color: '#ffffff', scale: 1, opacity: 1 }];
context.productionRender(0);
const titleNative = whiteBounds(app.canvas);
app.canvas.width = 640; app.canvas.height = 360;
context.productionRender(0);
const titleHalf = whiteBounds(app.canvas);
assert(titleNative.width > 200 && titleHalf.width > 100, 'text is visibly rendered');
assert(Math.abs(titleNative.width - titleHalf.width * 2) <= 4, 'title width stays proportional at export resolution');
assert(Math.abs(titleNative.height - titleHalf.height * 2) <= 4, 'title height stays proportional at export resolution');

// A square inside a portrait source must remain square in portrait output.
const portrait = createCanvas(720, 1280);
portrait.naturalWidth = portrait.width; portrait.naturalHeight = portrait.height;
const portraitContext = portrait.getContext('2d');
portraitContext.fillStyle = '#000000'; portraitContext.fillRect(0, 0, 720, 1280);
portraitContext.fillStyle = '#ffffff'; portraitContext.fillRect(180, 460, 360, 360);
resource.el = portrait;
app.canvas.width = 360; app.canvas.height = 640;
project.clips = [{ ...imageClip, scale: 1, keys: [], duration: 3 }];
context.productionRender(0);
assert.deepEqual(whiteBounds(app.canvas), { x: 90, y: 230, width: 180, height: 180 });
console.log(JSON.stringify({ passed: true, checks: ['native source detail during zoom', 'animated zoom source detail', 'project geometry at half resolution', 'project geometry at native resolution', 'text rerasterization at output resolution', 'portrait aspect ratio'], nativeZoom, animatedZoom, scope: 'production compositor with decoded canvas fixture; browser encoder not exercised' }));
