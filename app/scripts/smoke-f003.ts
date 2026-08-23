// Real functional check for F.003 — Response Profile: Four Questions +
// Declaration Pre-fill.
// Run with: npm run smoke:f003

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { section, summarize, test } from './testHarness';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Strips comment-only lines, per the lesson: a naive grep for a forbidden
 * word trips on a COMMENT correctly explaining why the word doesn't
 * appear in code, not just on real violations. */
function codeOnlyLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
}

async function main() {
  const { applyDeclarationPrefill, DECLARATION_PREFILL_DEFAULTS, saveResponseProfile } =
    await import('../src/engine/responseProfile');
  const { createProfile, getProfile } = await import('../src/engine/profileStore');

  section('F.003 — no condition field anywhere in ResponseProfile-related code (static check)');

  await test('responseProfile.ts and ResponseProfile.tsx declare no `condition` field', () => {
    for (const file of ['../src/engine/responseProfile.ts', '../src/screens/ResponseProfile.tsx']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      const code = codeOnlyLines(source);
      assert.ok(!/\bcondition\??\s*:/i.test(code), `found a condition: field in ${file}`);
      assert.ok(!/if\s*\(.*autis/i.test(code), `found an "if autism" branch in ${file}`);
      assert.ok(!/if\s*\(.*adhd/i.test(code), `found an "if adhd" branch in ${file}`);
    }
  });

  section('F.003 — declaration pre-fill: fills gaps only, never overwrites an existing answer');

  await test('on a fully empty ResponseProfile, prefill applies the fixed default bundle', () => {
    const filled = applyDeclarationPrefill({});
    assert.equal(filled.soundMovement, DECLARATION_PREFILL_DEFAULTS.soundMovement);
    assert.equal(filled.sameness, DECLARATION_PREFILL_DEFAULTS.sameness);
    assert.equal(filled.communication, DECLARATION_PREFILL_DEFAULTS.communication);
    // attentionSpan has no fixed default (§0 names three of the four
    // dimensions in the demo config, not all four) -- stays untouched.
    assert.equal(filled.attentionSpan, undefined);
  });

  await test('an answer the parent already gave survives prefill unchanged', () => {
    const filled = applyDeclarationPrefill({ soundMovement: 'lively', attentionSpan: 'brief' });
    assert.equal(filled.soundMovement, 'lively', 'prefill must not overwrite an existing answer');
    assert.equal(filled.attentionSpan, 'brief');
    // The other two dimensions, left unanswered, still get the default.
    assert.equal(filled.sameness, DECLARATION_PREFILL_DEFAULTS.sameness);
  });

  await test('every pre-filled answer is a real, changeable value -- not a locked/derived one', () => {
    const filled = applyDeclarationPrefill({});
    const changed = { ...filled, soundMovement: 'lively' as const };
    assert.equal(changed.soundMovement, 'lively', 'a pre-filled value must be freely overwritable');
  });

  section('F.003 — real round trip through the store: four dimensions + declaration, separately');

  let profileId = '';
  await test('createProfile then saveResponseProfile persists the four dimensions', async () => {
    const profile = await createProfile({ ageMonths: 40 });
    profileId = profile.id;
    await saveResponseProfile(
      profileId,
      { soundMovement: 'calm', attentionSpan: 'sustained', sameness: 'sameness-helps', communication: 'single-words' },
      undefined,
    );
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.responseProfile.soundMovement, 'calm');
    assert.equal(reloaded?.responseProfile.attentionSpan, 'sustained');
    assert.equal(reloaded?.responseProfile.sameness, 'sameness-helps');
    assert.equal(reloaded?.responseProfile.communication, 'single-words');
  });

  await test('declaring a diagnosis is stored separately and does not alter the four dimensions', async () => {
    await saveResponseProfile(
      profileId,
      { soundMovement: 'calm', attentionSpan: 'sustained', sameness: 'sameness-helps', communication: 'single-words' },
      { declared: true, note: 'told at intake' },
    );
    const reloaded = await getProfile(profileId);
    assert.equal(reloaded?.declaration?.declared, true);
    assert.equal(reloaded?.declaration?.note, 'told at intake');
    // Still the SAME four answers as before -- declaring did not silently
    // change tuning on its own.
    assert.equal(reloaded?.responseProfile.communication, 'single-words');
  });

  await test('all four questions are skippable: an empty ResponseProfile saves and loads fine', async () => {
    const profile = await createProfile({ ageMonths: 45 });
    await saveResponseProfile(profile.id, {}, undefined);
    const reloaded = await getProfile(profile.id);
    assert.deepEqual(reloaded?.responseProfile, {});
  });

  section('F.003 — demo config reachable: calm + sameness + minimal words (§0)');

  await test('the demo config is expressible as a real, saved ResponseProfile', async () => {
    const profile = await createProfile({ ageMonths: 38 });
    await saveResponseProfile(
      profile.id,
      { soundMovement: 'calm', sameness: 'sameness-helps', communication: 'not-with-words-yet' },
      undefined,
    );
    const reloaded = await getProfile(profile.id);
    assert.equal(reloaded?.responseProfile.soundMovement, 'calm');
    assert.equal(reloaded?.responseProfile.sameness, 'sameness-helps');
    assert.equal(reloaded?.responseProfile.communication, 'not-with-words-yet');
  });

  section('F.003 — the engine reads the four dimensions only, never `.declaration` (§5.3, static check)');

  await test('no engine, game or adapter file reads `.declaration` — display/pre-fill happens only in screens', () => {
    const rootDir = fileURLToPath(new URL('../src', import.meta.url));
    const scopedDirs = ['engine', 'games', 'adapters'].map((d) => path.join(rootDir, d));
    const offenders: string[] = [];
    for (const dir of scopedDirs) {
      let files: string[] = [];
      try {
        files = walk(dir);
      } catch {
        continue; // directory may not exist yet for some scopes
      }
      for (const file of files) {
        const code = codeOnlyLines(readFileSync(file, 'utf8'));
        if (/\.declaration\b/.test(code)) offenders.push(file);
      }
    }
    assert.deepEqual(offenders, [], `these engine/game/adapter files read .declaration: ${offenders.join(', ')}`);
  });

  await test('screens ARE allowed to read .declaration for display/pre-fill (sanity check the check itself works)', () => {
    const source = readFileSync(new URL('../src/screens/ResponseProfile.tsx', import.meta.url), 'utf8');
    assert.ok(/\.declaration\b/.test(source), 'expected the screen to read .declaration for pre-fill/display');
  });

  section('F.003 — no score, summary, or profile-type label shown back (§5.4, static check)');

  await test('ResponseProfile.tsx never renders a score, percentage, or combined profile-type label', () => {
    const source = readFileSync(new URL('../src/screens/ResponseProfile.tsx', import.meta.url), 'utf8');
    const code = codeOnlyLines(source);
    // "profile type" as two words (a displayed label) -- not identifiers
    // like `ResponseProfileType` that legitimately contain the substring.
    assert.ok(!/\bscore\b|\bpercent(age)?\b|\bprofile\s+type\b/i.test(code));
  });

  summarize();
}

void main();
