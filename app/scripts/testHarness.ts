// Tiny test harness — no framework installed yet, and this repo doesn't
// need one for two smoke scripts. node:assert/strict does the checking;
// this just tracks pass/fail and prints a summary with a non-zero exit
// code on any failure, so `npm run smoke` is a real CI-able gate.

let passed = 0;
let failed = 0;

export async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function section(name: string): void {
  console.log(`\n${name}`);
}

export function summarize(): void {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
