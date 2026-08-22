// F.014 — Branch 2: milestones & guided prompts (§9.1-9.3).
//
// Self-contained screen: everything it needs is `childAgeMonths` + an
// `onDone` callback. No dependency on P4's real onboarding screen (F.002) --
// whoever wires real navigation later just needs an entry point into this
// component and a handler for its result. See engine/branch2.ts for the
// content/logic this renders; that module carries the full rationale.
//
// Nothing on this screen is ever written to the log (F.014.md done-when).
// The Companion never appears here, deliberately (§10) -- this branch is
// for the parent, not the child.

import { useState } from 'react';
import {
  GUIDED_PROMPTS,
  OPEN_QUESTION,
  getMilestoneNarrative,
  isConcernAnswersComplete,
  type Branch2FlowResult,
} from '../engine/branch2';
import type { ConcernAnswers } from '../types';

interface Branch2MilestonesProps {
  childAgeMonths: number;
  /** Called exactly once, with the final result. `hasConcern: false` fires
   * the moment the parent answers "no" -- the flow ends right there, with
   * nothing else to show and nothing recorded (§9.3 step 3). */
  onDone: (result: Branch2FlowResult) => void;
}

type Step = 'narrative' | 'prompts';

export function Branch2Milestones({ childAgeMonths, onDone }: Branch2MilestonesProps) {
  const [step, setStep] = useState<Step>('narrative');
  const [answers, setAnswers] = useState<Partial<ConcernAnswers>>({});

  function handleAnswerChange(key: keyof ConcernAnswers, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!isConcernAnswersComplete(answers)) return;
    onDone({ hasConcern: true, answers, childAgeMonths });
  }

  if (step === 'narrative') {
    return (
      <div className="screen">
        <h2>What to expect around this age</h2>
        <p>{getMilestoneNarrative(childAgeMonths)}</p>
        <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          Every child's pace is different. This is general information, not a checklist to work
          through.
        </p>
        <p style={{ fontWeight: 600 }}>{OPEN_QUESTION}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => onDone({ hasConcern: false })}>
            No
          </button>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={() => setStep('prompts')}>
            Yes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <h2>A few questions to make this specific</h2>
      <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
        These three questions are always the same -- short answers are enough.
      </p>
      {GUIDED_PROMPTS.map((prompt) => (
        <label key={prompt.key} style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ marginBottom: 4 }}>{prompt.label}</div>
          <input
            type="text"
            value={answers[prompt.key] ?? ''}
            onChange={(e) => handleAnswerChange(prompt.key, e.target.value)}
            style={{ width: '100%', minHeight: 44, fontSize: '1rem' }}
          />
        </label>
      ))}
      <button
        style={{ minWidth: 88, minHeight: 88 }}
        disabled={!isConcernAnswersComplete(answers)}
        onClick={handleSubmit}
      >
        Continue
      </button>
    </div>
  );
}
