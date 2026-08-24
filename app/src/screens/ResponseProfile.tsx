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
//
// Toki revamp (mockup screen 04): the eyebrow/progress pair stays fixed
// ("How does your child do best?"), the big heading is the question
// itself, and options render as the shared toki-selectable-group/row —
// same visual language QuickPreferences and Onboarding now use.

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
  onBack?: () => void;
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

const QUESTIONS = [
  {
    prompt: 'How does your child handle sound and movement on a screen?',
    options: SOUND_OPTIONS,
    key: 'soundMovement' as const,
  },
  {
    prompt: 'How long does your child usually stay with one thing?',
    options: ATTENTION_OPTIONS,
    key: 'attentionSpan' as const,
  },
  {
    prompt: 'Does your child do better when things happen the same way every time?',
    options: SAMENESS_OPTIONS,
    key: 'sameness' as const,
  },
  {
    prompt: 'How does your child let you know what they want?',
    options: COMMUNICATION_OPTIONS,
    key: 'communication' as const,
  },
];

const TOTAL_QUESTIONS = QUESTIONS.length;

export function ResponseProfileScreen({ profile, onComplete, onBack }: ResponseProfileProps) {
  const [answers, setAnswers] = useState<ResponseProfileType>(profile.responseProfile);
  const [declared, setDeclared] = useState(profile.declaration?.declared ?? false);
  const [note, setNote] = useState(profile.declaration?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const isLastQuestion = questionIndex === TOTAL_QUESTIONS - 1;
  const current = QUESTIONS[questionIndex];

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
    <div className="toki-onboard-screen">
      <div className="toki-onboard-blobs" aria-hidden="true" />
      <div className="toki-onboard-header">
        <div className="toki-progress">
          <span className="toki-progress-label">How does your child do best?</span>
          <div className="toki-progress-bar">
            {QUESTIONS.map((q, i) => (
              <span
                key={q.key}
                className={
                  i <= questionIndex ? 'toki-progress-seg toki-progress-seg--filled' : 'toki-progress-seg'
                }
              />
            ))}
          </div>
        </div>
        <span className="toki-progress-count">
          {questionIndex + 1} of {TOTAL_QUESTIONS}
        </span>
      </div>

      <h2 className="toki-heading toki-heading--question">{current.prompt}</h2>
      <p className="toki-lede">Skip any, change them any time.</p>

      <div className="toki-selectable-group">
        {current.options.map((opt) => {
          const selected = answers[current.key] === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={selected ? 'toki-selectable-row toki-selectable-row--selected' : 'toki-selectable-row'}
              onClick={() => setAnswer(current.key, opt.value)}
            >
              {opt.label}
              <span className="toki-selectable-radio" aria-hidden="true">
                {selected && <span className="toki-selectable-radio-dot" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="toki-note">
        <span aria-hidden="true">🌱</span>
        <p>
          Nothing here is wrong, this is simply what the screen is. Your answers only shape how
          things are paced and phrased.
        </p>
      </div>

      {isLastQuestion && (
        <div className="toki-card">
          <p className="toki-lede" style={{ margin: 0 }}>
            If your child has a diagnosis and you&rsquo;d like to tell us, you can, but you
            don&rsquo;t have to, and nothing changes if you skip it.
          </p>
          <button type="button" className="toki-secondary-btn" onClick={() => toggleDeclaration(!declared)}>
            {declared ? 'Thanks, noted' : 'Tell us (optional)'}
          </button>
          {declared && (
            <textarea
              className="toki-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Say as much or as little as you like (optional)"
            />
          )}
        </div>
      )}

      <div className="toki-footer">
        <div className="toki-footer-row">
          {questionIndex > 0 ? (
            <button
              type="button"
              className="toki-secondary-btn"
              onClick={() => setQuestionIndex((i) => i - 1)}
            >
              Back
            </button>
          ) : (
            onBack && (
              <button type="button" className="toki-secondary-btn" onClick={onBack}>
                Back
              </button>
            )
          )}
          <button
            type="button"
            className="toki-cta"
            disabled={isLastQuestion && saving}
            onClick={() => (isLastQuestion ? void handleContinue() : setQuestionIndex((i) => i + 1))}
          >
            {isLastQuestion ? 'Continue' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
