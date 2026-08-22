// F.003 — Response profile: four questions, no condition field, ever.
// See app-guide-v3-FINAL.md §5.2, §5.3, §5.4.
//
// Reads as preferences a parent already knows, not an assessment (§5.4):
// no scoring, no summary screen shown back, no profile-type label, no
// completion percentage. Each question is independently skippable — there
// is simply no "unanswered" styling, just an unselected set of options.
// Wording is observational throughout, matching the guide's phrasing
// exactly rather than an evaluative rewrite.

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

export function ResponseProfileScreen({ profile, onComplete }: ResponseProfileProps) {
  const [answers, setAnswers] = useState<ResponseProfileType>(profile.responseProfile);
  const [declared, setDeclared] = useState(profile.declaration?.declared ?? false);
  const [note, setNote] = useState(profile.declaration?.note ?? '');
  const [saving, setSaving] = useState(false);

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
      <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Four questions. Skip any. Change them any time.</p>

      <QuestionBlock
        prompt="How does your child handle sound and movement on a screen?"
        options={SOUND_OPTIONS}
        value={answers.soundMovement}
        onChange={(v) => setAnswer('soundMovement', v)}
      />
      <QuestionBlock
        prompt="How long does your child usually stay with one thing?"
        options={ATTENTION_OPTIONS}
        value={answers.attentionSpan}
        onChange={(v) => setAnswer('attentionSpan', v)}
      />
      <QuestionBlock
        prompt="Does your child do better when things happen the same way every time?"
        options={SAMENESS_OPTIONS}
        value={answers.sameness}
        onChange={(v) => setAnswer('sameness', v)}
      />
      <QuestionBlock
        prompt="How does your child let you know what they want?"
        options={COMMUNICATION_OPTIONS}
        value={answers.communication}
        onChange={(v) => setAnswer('communication', v)}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: '0.85rem' }}>
          If your child has a diagnosis and you&rsquo;d like to tell us, you can — but you don&rsquo;t
          have to, and nothing changes if you skip it.
        </p>
        <button onClick={() => toggleDeclaration(!declared)}>
          {declared ? 'Thanks — noted' : 'Tell us (optional)'}
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

      <button disabled={saving} onClick={() => void handleContinue()}>
        Continue
      </button>
    </div>
  );
}

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p>{prompt}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              background: value === opt.value ? '#333' : 'white',
              color: value === opt.value ? 'white' : 'black',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
