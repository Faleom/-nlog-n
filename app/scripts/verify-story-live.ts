// F.022 redesign — REAL, PAID verification of the ClaudeStory adapter's
// prompt and response parsing, using a genuine Anthropic API call.
//
// Run manually with: npx tsx scripts/verify-story-live.ts
// NOT wired into `npm run smoke` or `package.json`'s smoke chain, and NOT
// run automatically by anything -- same reasoning as verify-vision-live.ts:
// every run of this script costs real money and needs ANTHROPIC_API_KEY +
// network. This script makes exactly ONE call.
//
// There is no deployed instance of api/claude.ts running anywhere in this
// sandbox to hit over HTTP, so this calls the Anthropic SDK directly, in
// the same shape api/claude.ts itself uses server-side for `kind: 'story'`
// (same model, same STORY_PROMPT text and same data-block format -- copy-
// checked against both src/adapters/story/claudeStory.ts's exported
// constant and api/claude.ts's hardcoded literal). This proves the PROMPT
// and the PARSING genuinely work against a real model response; it does not
// exercise the browser-side fetch() wiring in claudeStory.ts itself, which
// needs a real browser/runtime environment (see that file's header).
//
// The test objects are a fixed, plausible little household set (a bath, a
// rubber duck, a towel) -- doesn't need to come from a real photo, since
// this script tests only the STORY half of the pipeline, not vision.
//
// NEVER logs, prints, or persists the API key.

import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { STORY_PROMPT } from '../src/adapters/story/claudeStory';
import { parseStoryResponse } from '../src/adapters/story/storyParsing';
import type { DetectedObjectForStory } from '../src/adapters/ports';

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

async function main() {
  loadDotEnv(new URL('../.env', import.meta.url).pathname);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes('REPLACE-ME')) {
    console.error('No real ANTHROPIC_API_KEY found in app/.env — skipping live verification.');
    console.error("This is a manual, opt-in, paid check — see this file's header.");
    process.exitCode = 1;
    return;
  }

  const objects: DetectedObjectForStory[] = [
    { name: 'bath', colour: 'white', category: 'furniture', function: 'wash in' },
    { name: 'duck', colour: 'yellow', category: 'toy', function: 'play with' },
    { name: 'towel', colour: 'blue', category: 'linen', function: 'dry off with' },
  ];
  const childAgeMonths = 36;

  const objectsText = `Detected objects (JSON array, each with name/colour/category/function -- use these exact "name" values for "objectRef"):
${JSON.stringify(objects)}

Child's age: ${childAgeMonths} months.`;

  console.log('Calling claude-haiku-4-5 with the real STORY_PROMPT (one call)...');
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: objectsText },
          { type: 'text', text: STORY_PROMPT },
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

  try {
    const story = parseStoryResponse(text, objects);
    console.log(`parseStoryResponse extracted ${story.steps.length} step(s):`);
    for (const step of story.steps) {
      console.log(`  - [${step.objectRef}] ${step.sentence}`);
    }
    console.log('\nPASS: a real claude-haiku-4-5 call round-tripped through STORY_PROMPT and parseStoryResponse.');
  } catch (err) {
    console.error('\nFAIL: the real model response did not pass validation.');
    console.error(err instanceof Error ? err.message : String(err));
    console.error(
      'Either the prompt needs adjusting or storyParsing.ts is too strict for a real response shape.',
    );
    process.exitCode = 1;
  }
}

void main();
