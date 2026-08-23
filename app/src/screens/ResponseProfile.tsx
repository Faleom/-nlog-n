// F.003 — Response profile: four questions, no condition field, ever.
// See app-guide-v3-FINAL.md §5.2, §5.3, §5.4.
//
// Reads as preferences a parent already knows, not an assessment (§5.4):
// no scoring, no summary screen shown back, no profile-type label, no
// completion percentage. Each question is independently skippable — there
// is simply no "unanswered" styling, just an unselected set of options.
// Wording is observational throughout, matching the guide's phrasing
// exactly rather than an evaluative rewrite.
//
// One question per screen, not all four stacked — product-owner feedback
// on the earlier all-at-once layout was that it read as crowded and gave
// no clear "what do I look at first" anchor. `questionIndex` is local,
// throwaway UI state (not persisted, not part of ResponseProfileType) —
// going back to Setup and re-entering this screen always starts at
// question 1 again, which is fine: nothing about "which question you
// last looked at" is meaningful data.

import { useState } from 'react';
import { applyDeclarationPrefill, saveResponseProfile } from '../engine/responseProfile';
import type {
  AttentionSpanAnswer,
  ChildProfile,
  CommunicationAnswer,
  OptionalDeclaration,
  ResponseProfile as ResponseProfileType,
  SamenessAnswer,
  SoundMovementAnswer,
} from '../types';

interface ResponseProfileProps {
  profile: ChildProfile;
  onComplete: (profile: ChildProfile) => void;
}

const SOUND_OPTIONS: Array<{ value: SoundMovementAnswer; label: string }> = [
  { value: 'calm', label: 'Calm and quiet' },
  { value: 'neutral', label: "Doesn't mind" },
  { value: 'lively', label: 'Likes it lively' },
];
const ATTENTION_OPTIONS: Array<{ value: AttentionSpanAnswer; label: string }> = [
  { value: 'brief', label: 'A minute or two' },
  { value: 'moderate', label: 'A few minutes' },
  { value: 'sustained', label: 'Quite a while' },
];
const SAMENESS_OPTIONS: Array<{ value: SamenessAnswer; label: string }> = [
  { value: 'sameness-helps', label: 'Sameness helps a lot' },
  { value: 'somewhat', label: 'Somewhat' },
  { value: 'variety', label: 'They like variety' },
];
const COMMUNICATION_OPTIONS: Array<{ value: CommunicationAnswer; label: string }> = [
  { value: 'not-with-words-yet', label: 'Not with words yet' },
  { value: 'single-words', label: 'Single words' },
  { value: 'short-phrases', label: 'Short phrases' },
  { value: 'full-sentences', label: 'Full sentences' },
];

const TOTAL_QUESTIONS = 4;

export function ResponseProfileScreen({ profile, onComplete }: ResponseProfileProps) {
  const [answers, setAnswers] = useState<ResponseProfileType>(profile.responseProfile);
  const [declared, setDeclared] = useState(profile.declaration?.declared ?? false);
  const [note, setNote] = useState(profile.declaration?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const isLastQuestion = questionIndex === TOTAL_QUESTIONS - 1;

  function toggleDeclaration(next: boolean) {
    setDeclared(next);
    if (next) {
      setAnswers((prev) => applyDeclarationPrefill(prev));
    }
  }

  function setAnswer<K extends keyof ResponseProfileType>(key: K, value: ResponseProfileType[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleContinue() {
    setSaving(true);
    const declaration: OptionalDeclaration | undefined = declared
      ? { declared: true, note: note.trim() === '' ? undefined : note.trim() }
      : profile.declaration;
    const updated = await saveResponseProfile(profile.id, answers, declaration);
    setSaving(false);
    onComplete(updated);
  }

  return (
    <div className="screen">
      <h2>How does your child do best?</h2>
      <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
        Question {questionIndex + 1} of {TOTAL_QUESTIONS}. Skip any, change them any time.
      </p>

      {questionIndex === 0 && (
        <QuestionBlock
          prompt="How does your child handle sound and movement on a screen?"
          options={SOUND_OPTIONS}
          value={answers.soundMovement}
          onChange={(v) => setAnswer('soundMovement', v)}
        />
      )}
      {questionIndex === 1 && (
        <QuestionBlock
          prompt="How long does your child usually stay with one thing?"
          options={ATTENTION_OPTIONS}
          value={answers.attentionSpan}
          onChange={(v) => setAnswer('attentionSpan', v)}
        />
      )}
      {questionIndex === 2 && (
        <QuestionBlock
          prompt="Does your child do better when things happen the same way every time?"
          options={SAMENESS_OPTIONS}
          value={answers.sameness}
          onChange={(v) => setAnswer('sameness', v)}
        />
      )}
      {questionIndex === 3 && (
        <QuestionBlock
          prompt="How does your child let you know what they want?"
          options={COMMUNICATION_OPTIONS}
          value={answers.communication}
          onChange={(v) => setAnswer('communication', v)}
        />
      )}

      {isLastQuestion && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '0.85rem' }}>
            If your child has a diagnosis and you&rsquo;d like to tell us, you can, but you don&rsquo;t
            have to, and nothing changes if you skip it.
          </p>
          <button onClick={() => toggleDeclaration(!declared)}>
            {declared ? 'Thanks, noted' : 'Tell us (optional)'}
          </button>
          {declared && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Say as much or as little as you like (optional)"
              style={{ minHeight: 44, fontSize: '1rem' }}
            />
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {questionIndex > 0 && (
          <button
            style={{ flex: '0 1 auto' }}
            onClick={() => setQuestionIndex((i) => i - 1)}
          >
            Back
          </button>
        )}
        <button
          className="button-primary"
          style={{ flex: 1 }}
          disabled={isLastQuestion && saving}
          onClick={() => (isLastQuestion ? void handleContinue() : setQuestionIndex((i) => i + 1))}
        >
          {isLastQuestion ? 'Continue' : 'Next'}
        </button>
      </div>
    </div>
  );
}

/** One question, one screen. Options render as a plain list — a small
 * circular selector indicator is the only thing that's "boxed"; the
 * label itself sits on the bare background, not inside a filled button.
 * The tap target is still the FULL row (a real <button>, base rule's
 * touch-target floor intact) — only the decoration shrank, matching how
 * the rest of this app's controls stay tappable everywhere they look
 * clickable, never just on a small visual accent. */
function QuestionBlock<T extends string>({
  prompt,
  options,
  value,
  onChange,
}: {
  prompt: string;
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p>{prompt}</p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '12px 4px',
                textAlign: 'left',
                fontSize: '1rem',
                fontWeight: selected ? 600 : 400,
                borderRadius: 0,
                border: 'none',
                borderBottom: '1px solid var(--color-border)',
                background: 'transparent',
                boxShadow: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                color: 'var(--color-ink)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  borderRadius: '50%',
                  border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                  background: selected ? 'var(--color-primary)' : 'transparent',
                }}
              >
                {selected && (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--color-primary-ink)',
                    }}
                  />
                )}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
