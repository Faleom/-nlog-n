// Real TextGenPort adapter. F.015.
//
// Per ARCHITECTURE-RULES.md, this file may import a vendor SDK directly
// (it's inside src/adapters/**) -- but it deliberately does NOT. The
// Anthropic API key is server-only (api/.env's ANTHROPIC_API_KEY, never
// VITE_-prefixed -- see .env.example), so this file calls the one
// serverless proxy (api/claude.ts) over fetch instead of constructing an
// Anthropic client in browser-bundled code, which would either ship no key
// (useless) or a hardcoded one (a §14 violation). See
// TECH-DECISIONS.md "Hosting & secrets".
//
// The §9.4 guardrail is applied HERE, per the doc comment on
// TextGenPort.generateCard in ../ports.ts: "Must apply the §9.4
// post-generation guardrail internally and throw a GuardrailFailedError if
// it fails." The server (api/claude.ts) only proxies the model call and
// returns raw text -- it never decides pass/fail.

import { checkCardGuardrail } from '../../engine/branch2Guardrail';
import { assembleCard } from '../../engine/branch2Card';
import { GuardrailFailedError, type TextGenPort } from '../ports';

// Structurally typed rather than relying on the ambient `ImportMetaEnv`
// augmentation from vite/client -- this file is transitively imported by
// scripts/*.ts (via adapters/registry -> engine/profileStore), whose
// tsconfig (tsconfig.scripts.json) doesn't load vite/client's types. This
// keeps the real Vite runtime behaviour (import.meta.env.VITE_API_BASE_URL)
// while still type-checking cleanly under both tsconfig projects.
function apiBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_API_BASE_URL ?? '/api';
}

export function createHaikuCard(): TextGenPort {
  return {
    async generateCard(answers) {
      const res = await fetch(`${apiBaseUrl()}/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'card',
          whatNoticed: answers.whatNoticed,
          whenNoticed: answers.whenNoticed,
          whatItLooksLike: answers.whatItLooksLike,
          childAgeMonths: answers.childAgeMonths,
        }),
      });

      if (!res.ok) {
        throw new Error(`Card generation proxy request failed: ${res.status}`);
      }

      const data = (await res.json()) as { observation?: string; error?: string };
      if (!data.observation) {
        throw new Error(data.error ?? 'Card generation proxy returned no observation text');
      }

      const check = checkCardGuardrail(data.observation);
      if (!check.passed) {
        // §9.4: "If the check fails, the card is not shown." The caller
        // (Branch2Card.tsx) is responsible for catching this and falling
        // back to RawTextCard -- see adapters/textgen/rawTextCard.ts.
        throw new GuardrailFailedError();
      }

      return assembleCard(answers.childAgeMonths, data.observation);
    },
  };
}
