// F.015 — Branch 2: card, guardrail, save & handoff back (§9.3-9.5, §15).
//
// Self-contained screen, same pattern as Branch2Milestones.tsx (F.014):
// takes the answers F.014 already collected + a callback for the handoff
// back to Branch 1. Whoever wires real navigation connects
// Branch2Milestones' `hasConcern: true` result into this component's props.
//
// Flow: generate (Haiku, guardrail-checked) -> if the guardrail fails,
// silently fall back to the parent's own raw text, never showing a
// generated card that didn't pass -> parent reviews and can edit before
// saving -> save -> two equal paths (bring it in / not ready yet), neither
// of which changes anything about what's saved -> immediately offer a
// Branch 1 activity (§9.3 step 9), regardless of which path was chosen.

import { useEffect, useState } from 'react';
import { adapters } from '../adapters/registry';
import { createRawTextCard } from '../adapters/textgen/rawTextCard';
import { GuardrailFailedError } from '../adapters/ports';
import { saveQuestionCard } from '../engine/profileStore';
import type { ConcernAnswers, QuestionCard } from '../types';

// §15: placeholder referral data. VISIBLY MARKED as placeholder, in the UI
// and on the printed card -- never presented as real (§15's own rule).
// Swap for real, verified local service info before this ships.
const PLACEHOLDER_HEALTH_SERVICE = {
  name: '[PLACEHOLDER] Community Child Health Service',
  schedule: '[PLACEHOLDER] Walk-in clinic, Tuesdays & Thursdays 9am-12pm',
};

interface Branch2CardProps {
  answers: ConcernAnswers;
  childAgeMonths: number;
  /** §9.3 step 9 -- called once, right after the card is saved, regardless
   * of which of the two equal paths the parent picks. Whoever wires real
   * navigation connects this to a real Branch 1 activity offer. */
  onOfferActivity: () => void;
}

type Phase = 'generating' | 'reviewing' | 'saved';

function newCardId(): string {
  return crypto.randomUUID();
}

export function Branch2Card({ answers, childAgeMonths, onOfferActivity }: Branch2CardProps) {
  const [phase, setPhase] = useState<Phase>('generating');
  const [cardText, setCardText] = useState('');
  const [guardrailPassed, setGuardrailPassed] = useState(false);
  const [pathChosen, setPathChosen] = useState<'bring-it-in' | 'not-ready-yet' | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fullAnswers = { ...answers, childAgeMonths };
      try {
        const generated = await adapters.textGen.generateCard(fullAnswers);
        if (cancelled) return;
        setCardText(generated);
        setGuardrailPassed(true);
      } catch (err) {
        // §9.4: guardrail failure -> offer the parent's own raw words,
        // never a partially-generated or unchecked card. Any OTHER error
        // (e.g. the proxy being unreachable) degrades the same safe way --
        // raw text is always safe, so it's the right fallback either way.
        if (!(err instanceof GuardrailFailedError)) {
          console.warn('Card generation failed, falling back to raw text:', err);
        }
        const raw = await createRawTextCard().generateCard(fullAnswers);
        if (cancelled) return;
        setCardText(raw);
        setGuardrailPassed(false);
      } finally {
        if (!cancelled) setPhase('reviewing');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per mount -- this screen is given one fixed set of answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    const card: QuestionCard = {
      id: newCardId(),
      childAgeMonths,
      observationText: cardText,
      createdAt: new Date().toISOString(),
      guardrailPassed,
    };
    await saveQuestionCard(card);
    setPhase('saved');
  }

  function handlePathChosen(path: 'bring-it-in' | 'not-ready-yet') {
    // Both paths are equal (F.015.md: "not ready yet: stays saved, no
    // nagging, no reminder, ever"). Recording the choice is purely for the
    // parent's own UI feedback -- nothing downstream branches on it, and
    // neither path schedules anything.
    setPathChosen(path);
    onOfferActivity();
  }

  if (phase === 'generating') {
    return (
      <div className="screen">
        <p>Putting your notes into a clear question…</p>
      </div>
    );
  }

  if (phase === 'reviewing') {
    return (
      <div className="screen">
        <h2>Here's your question, ready to bring in</h2>
        {!guardrailPassed && (
          <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            We couldn't safely rewrite this, so here are your own words instead.
          </p>
        )}
        <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          This is yours to change. Edit anything before you save it.
        </p>
        <textarea
          value={cardText}
          onChange={(e) => setCardText(e.target.value)}
          rows={10}
          style={{ width: '100%', fontSize: '1rem' }}
        />
        <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => void handleSave()}>
          Save
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div id="printable-card">
        <h2>Saved</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{cardText}</pre>
        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
          Nearest service (placeholder, replace with a real, verified local listing):
        </p>
        <p style={{ fontSize: '0.8rem' }}>
          {PLACEHOLDER_HEALTH_SERVICE.name}
          <br />
          {PLACEHOLDER_HEALTH_SERVICE.schedule}
        </p>
      </div>
      <button style={{ minWidth: 88 }} onClick={() => window.print()}>
        Print
      </button>
      {pathChosen === null && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => handlePathChosen('bring-it-in')}>
            I'll bring this in
          </button>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => handlePathChosen('not-ready-yet')}>
            Not ready yet
          </button>
        </div>
      )}
      {pathChosen !== null && (
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          Saved either way. No reminders, no follow-up. It's here whenever you want it.
        </p>
      )}
    </div>
  );
}
