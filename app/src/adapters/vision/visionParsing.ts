// Pure parsing/geometry helpers for the ClaudeVision adapter (F.006). Kept
// separate from claudeVision.ts (which does the actual network + canvas
// work) so the part that's most likely to break in the real world — "did
// the model's text response actually parse into usable objects" — is
// testable in Node with fabricated response text, no network or DOM
// required. See scripts/smoke-f006.ts and verify-vision-live.ts (the real,
// paid, manual verification script).
//
// TECH-DECISIONS.md § Object recognition: "bbox precision" is the top
// technical risk after face blur. Vision models describe well and localise
// approximately — this file's `regionFromRawBbox` is where that padding
// mitigation (#1: "pad the boxes generously") actually happens.

import type { Region } from '../../types';
import { clampRegion, padRegion, type Size } from '../imaging/regionMath';

/** The shape we ask Claude to return one array entry as. Field names match
 * TaggedCrop minus `id`/`image`, which the adapter fills in itself. */
export interface RawVisionObject {
  name: string;
  colour: string;
  category: string;
  function: string;
  bbox: Region;
}

/** How generously to pad a vision bbox before cropping — bboxes come back
 * approximate (TECH-DECISIONS.md), so a recognisable crop needs slack on
 * every side rather than a pixel-tight cut that might miss the object. */
export const VISION_BBOX_PADDING_FRACTION = 0.15;

/**
 * Claude is asked for a JSON array and (per the prompt in claudeVision.ts)
 * nothing else, but text models occasionally wrap it in prose or a
 * markdown code fence anyway. This extracts the first plausible JSON array
 * substring and parses it, rather than assuming `response.trim()` is
 * exactly the array.
 */
export function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  // Fast path: the whole response is already the array.
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to the tolerant path below
  }
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in vision response');
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isValidBbox(v: unknown): v is Region {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return isFiniteNumber(b.x) && isFiniteNumber(b.y) && isFiniteNumber(b.width) && isFiniteNumber(b.height);
}

function isValidRawObject(v: unknown): v is RawVisionObject {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    o.name.trim().length > 0 &&
    typeof o.colour === 'string' &&
    typeof o.category === 'string' &&
    typeof o.function === 'string' &&
    isValidBbox(o.bbox)
  );
}

/**
 * Parses a raw Claude response body (the text content of the message) into
 * validated objects. Silently DROPS malformed entries rather than throwing
 * for the whole batch — one bad entry in a list of five real ones should
 * degrade to four crops, not zero (§11: "recognition returns nothing
 * usable → fall back to generic activities", which only kicks in if the
 * usable count is actually zero).
 */
export function parseVisionResponse(text: string): RawVisionObject[] {
  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidRawObject);
}

/**
 * Turns a raw (approximate, unpadded) bbox from the model into a padded,
 * image-bounds-clamped crop region — see VISION_BBOX_PADDING_FRACTION and
 * TECH-DECISIONS.md mitigation #1.
 */
export function regionFromRawBbox(bbox: Region, imageSize: Size): Region {
  return padRegion(clampRegion(bbox, imageSize), imageSize, VISION_BBOX_PADDING_FRACTION);
}
