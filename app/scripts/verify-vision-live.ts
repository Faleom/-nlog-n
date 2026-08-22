// F.006 — REAL, PAID verification of the ClaudeVision adapter's prompt and
// response parsing, using a genuine Anthropic API call.
//
// Run manually with: npx tsx scripts/verify-vision-live.ts
// NOT wired into `npm run smoke` or `package.json`'s smoke chain on
// purpose — every run of this script costs real money and needs
// ANTHROPIC_API_KEY + network. The brief is explicit: "keep it to a
// handful of real calls for verification, not a loop." This script makes
// exactly ONE call.
//
// There is no deployed instance of api/claude.ts running anywhere in this
// sandbox to hit over HTTP, so this calls the Anthropic SDK directly, in
// the same shape api/claude.ts itself uses server-side (same model, same
// VISION_PROMPT text — copy-checked against both src/adapters/vision/
// claudeVision.ts's exported constant and api/claude.ts's hardcoded
// literal). This proves the PROMPT and the PARSING genuinely work against
// a real model response; it does not exercise the browser-side fetch()
// wiring or the Canvas cropping code in claudeVision.ts itself, which need
// a real browser (see that file's header).
//
// The test image is a plain generated PNG (a red square and a blue
// square on a grey field) — "doesn't need to be a real room" per the
// brief. It's genuinely redacted-shape-wise irrelevant (no face to blur),
// which is correct: this script tests the VISION half of the pipeline in
// isolation, not the face-blur half (that's scripts/smoke-f006.ts's job,
// fully offline).
//
// NEVER logs, prints, or persists the API key.

import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import Anthropic from '@anthropic-ai/sdk';
import { VISION_PROMPT } from '../src/adapters/vision/claudeVision';
import { parseVisionResponse } from '../src/adapters/vision/visionParsing';

function loadDotEnv(path: string): void {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
// A minimal, dependency-free PNG encoder — just enough to build a flat
// RGB test image (no canvas package installed, and this is a one-off
// script, not shipped adapter code). PNG chunk format: signature, then
// length(4)+type(4)+data+crc32(4) chunks; IDAT is zlib-compressed raw
// scanlines, one leading filter-type byte (0 = none) per row.
// ---------------------------------------------------------------------------

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Builds a flat width x height RGB PNG: grey background, a red square in
 * the left third, a blue square in the right third — two distinct,
 * describable "objects" for the model to report on. */
function buildTestPng(width: number, height: number): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  const redBox = { x0: Math.floor(width * 0.1), x1: Math.floor(width * 0.35), y0: Math.floor(height * 0.3), y1: Math.floor(height * 0.7) };
  const blueBox = { x0: Math.floor(width * 0.65), x1: Math.floor(width * 0.9), y0: Math.floor(height * 0.3), y1: Math.floor(height * 0.7) };

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const inRed = x >= redBox.x0 && x < redBox.x1 && y >= redBox.y0 && y < redBox.y1;
      const inBlue = x >= blueBox.x0 && x < blueBox.x1 && y >= blueBox.y0 && y < blueBox.y1;
      const i = rowStart + 1 + x * 3;
      if (inRed) {
        raw[i] = 220;
        raw[i + 1] = 30;
        raw[i + 2] = 30;
      } else if (inBlue) {
        raw[i] = 30;
        raw[i + 1] = 60;
        raw[i + 2] = 220;
      } else {
        raw[i] = 200;
        raw[i + 1] = 200;
        raw[i + 2] = 195;
      }
    }
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const idatData = deflateSync(raw);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  loadDotEnv(new URL('../.env', import.meta.url).pathname);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes('REPLACE-ME')) {
    console.error('No real ANTHROPIC_API_KEY found in app/.env — skipping live verification.');
    console.error('This is a manual, opt-in, paid check — see this file\'s header.');
    process.exitCode = 1;
    return;
  }

  console.log('Building a small synthetic test image (red square + blue square on grey)...');
  const png = buildTestPng(256, 256);
  const base64 = png.toString('base64');
  console.log(`Test image built: ${png.length} bytes, base64 length ${base64.length}.`);

  console.log('Calling claude-sonnet-5 with the real VISION_PROMPT (one call)...');
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
          { type: 'text', text: VISION_PROMPT },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  console.log('\n--- Raw response text ---');
  console.log(text);
  console.log('--- end raw response ---\n');

  const parsed = parseVisionResponse(text);
  console.log(`parseVisionResponse extracted ${parsed.length} object(s):`);
  for (const obj of parsed) {
    console.log(`  - ${obj.name} (${obj.colour}, ${obj.category}) bbox=${JSON.stringify(obj.bbox)}`);
  }

  if (parsed.length === 0) {
    console.error(
      '\nFAIL: the real model response did not parse into any usable objects. ' +
        'Either the prompt needs adjusting or visionParsing.ts is too strict for a real response shape.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('\nPASS: a real claude-sonnet-5 call round-tripped through VISION_PROMPT and parseVisionResponse.');
  console.log(
    'Note: bboxes above are the model\'s own approximate localisation on a 256x256 synthetic image — ' +
      'consistent with TECH-DECISIONS.md\'s "bbox precision is the top technical risk after face blur", ' +
      'which is exactly why regionFromRawBbox() pads before cropping rather than trusting these pixel-tight.',
  );
}

void main();
