/**
 * Extracts frames from health_bar.gif into individual PNGs.
 * Run once: node scripts/extract-health-bar-frames.js
 *
 * Requires:  npm install --save-dev gifuct-js jimp
 */

const fs   = require('fs');
const path = require('path');
const { parseGIF, decompressFrames } = require('gifuct-js');
const { Jimp } = require('jimp');

const GIF_PATH    = path.join(__dirname, '../src/assets/health_bar.gif');
const OUT_DIR     = path.join(__dirname, '../src/assets/health_bar_frames');
const FRAMES_JS   = path.join(OUT_DIR, 'frames.js');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const buffer = fs.readFileSync(GIF_PATH);
const gif    = parseGIF(new Uint8Array(buffer).buffer);
const frames = decompressFrames(gif, true);

console.log(`Found ${frames.length} frames — extracting…`);

async function run() {
  // gifuct-js gives us per-frame patches; we composite onto a canvas buffer
  // to handle partial-frame GIFs correctly.
  const { width, height } = gif.lsd; // logical screen dimensions
  const canvas = Buffer.alloc(width * height * 4, 0);

  for (let i = 0; i < frames.length; i++) {
    const frame  = frames[i];
    const { dims, patch } = frame;

    // Composite patch onto canvas
    for (let y = 0; y < dims.height; y++) {
      for (let x = 0; x < dims.width; x++) {
        const srcIdx = (y * dims.width + x) * 4;
        const dstIdx = ((dims.top + y) * width + (dims.left + x)) * 4;
        const a = patch[srcIdx + 3];
        if (a > 0) {
          canvas[dstIdx]     = patch[srcIdx];
          canvas[dstIdx + 1] = patch[srcIdx + 1];
          canvas[dstIdx + 2] = patch[srcIdx + 2];
          canvas[dstIdx + 3] = a;
        }
      }
    }

    const img = new Jimp({ data: Buffer.from(canvas), width, height });
    const outFile = path.join(OUT_DIR, `frame_${String(i).padStart(3, '0')}.png`);
    await img.write(outFile);
    process.stdout.write(`  frame ${i + 1}/${frames.length}\r`);
  }

  // Generate frames.js so React Native can require() them all at bundle time
  const lines = [
    '// AUTO-GENERATED — do not edit. Re-run scripts/extract-health-bar-frames.js to regenerate.',
    'const HEALTH_BAR_FRAMES = [',
    ...Array.from({ length: frames.length }, (_, i) =>
      `  require('./frame_${String(i).padStart(3, '0')}.png'),`
    ),
    '];',
    'export default HEALTH_BAR_FRAMES;',
  ];
  fs.writeFileSync(FRAMES_JS, lines.join('\n') + '\n');

  console.log(`\nDone! ${frames.length} frames → ${OUT_DIR}`);
  console.log(`Generated: ${FRAMES_JS}`);
}

run().catch(err => { console.error(err); process.exit(1); });
