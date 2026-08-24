// F.016 — Context profile: quick preferences. Tap-only, no typing
// anywhere.
//
// Now a two-page flow: page 1 is the single remaining quick-preference
// question (favourite colour); page 2 folds in the Companion capture flow
// (F.004) that used to be its own separate top-level screen, since the
// product direction collapsed "Favourites" and "Companion" into one
// setup step. `page` is local, throwaway UI state, same reasoning as
// ResponseProfile's questionIndex — re-entering this screen always starts
// back on page 1.

import { useState } from 'react';
import { saveQuickPreferences, shouldAskIsCompanionStillFavourite } from '../engine/quickPreferences';
import type { ChildProfile } from '../types';
import { CompanionCapture } from './CompanionCapture';

interface QuickPreferencesProps {
  profile: ChildProfile;
  onComplete: (profile: ChildProfile) => void;
}

const COLOURS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

export function QuickPreferencesScreen({ profile, onComplete }: QuickPreferencesProps) {
  const existing = profile.context.quickPreferences ?? {};
  const [favColour, setFavColour] = useState(existing.favColour);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<'colour' | 'companion'>('colour');
  // The profile as of the end of page 1 -- companion capture (page 2)
  // needs the freshest profile, and skipping page 2 finishes the whole
  // flow with whatever that save produced (or the original prop if page 1
  // was never reached/saved, though in practice page 1 always saves
  // before advancing -- see handleContinue).
  const [profileAfterColour, setProfileAfterColour] = useState(profile);

  async function handleContinue() {
    setSaving(true);
    // Preserves the old behaviour: "Continue" always saves, even if
    // favColour is still undefined (nothing tapped) -- colour was never a
    // forced choice, only the act of advancing was unconditional.
    const updated = await saveQuickPreferences(profile.id, { favColour });
    setSaving(false);
    setProfileAfterColour(updated);
    setPage('companion');
  }

  if (page === 'companion') {
    return (
      <div className="screen">
        <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Step 2 of 2</p>
        <CompanionCapture
          profile={profileAfterColour}
          onComplete={(updatedProfile) => onComplete(updatedProfile)}
          onSkip={() => onComplete(profileAfterColour)}
        />
        <button style={{ flex: '0 1 auto' }} onClick={() => setPage('colour')}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h2>A few favourites</h2>
      <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
        Step 1 of 2. Tap what fits, skip if you like.
      </p>

      <ChipRow label="Favourite colour" options={COLOURS} value={favColour} onChange={setFavColour} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="button-primary"
          style={{ flex: 1 }}
          disabled={saving}
          onClick={() => void handleContinue()}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** Same minimal treatment as ResponseProfile.tsx's QuestionBlock: a small
 * circular selector is the only "boxed" element, the label sits on the
 * bare background. Still a real full-row <button> (base rule's
 * touch-target floor intact) -- only the decoration shrank. Tapping the
 * already-selected option clears it (`undefined`), same toggle behaviour
 * the old chip grid had -- these are all optional favourites, not a
 * forced choice. */
function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(selected ? undefined : opt)}
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
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * §6.5's one-tap check-in: "Is {companion} still the favourite?". Renders
 * nothing when it isn't due (see shouldAskIsCompanionStillFavourite) or
 * when there's no Companion to ask about.
 */
export function CompanionCheckIn({
  profile,
  completedSessionCount,
  onKeep,
  onChange,
}: {
  profile: ChildProfile;
  completedSessionCount: number;
  onKeep: () => void;
  onChange: () => void;
}) {
  const companion = profile.context.companion;
  if (!companion || !shouldAskIsCompanionStillFavourite(completedSessionCount)) return null;
  return (
    <div className="screen">
      <p>Is {companion.name} still the favourite?</p>
      <button onClick={onKeep}>Still the favourite</button>
      <button onClick={onChange}>Let&rsquo;s change it</button>
    </div>
  );
}
