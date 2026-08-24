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
//
// Toki revamp (mockup screen 05): six colours in a 3-column swatch grid.
// Pink dropped per explicit product direction, leaving a clean 2x3 grid
// with no leftover seventh option to give special treatment to. Page 2
// has no mockup of its own — CompanionCapture.tsx carries the same
// toki-onboard-* chrome so the two pages of one flow don't visually
// disagree with each other.

import { useState } from 'react';
import { saveQuickPreferences, shouldAskIsCompanionStillFavourite } from '../engine/quickPreferences';
import type { ChildProfile } from '../types';
import { CompanionCapture } from './CompanionCapture';

interface QuickPreferencesProps {
  profile: ChildProfile;
  onComplete: (profile: ChildProfile) => void;
  onBack?: () => void;
}

const COLOURS: Array<{ value: string; label: string }> = [
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
];

export function QuickPreferencesScreen({ profile, onComplete, onBack }: QuickPreferencesProps) {
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
      <CompanionCapture
        profile={profileAfterColour}
        onBack={() => setPage('colour')}
        onComplete={(updatedProfile) => onComplete(updatedProfile)}
        onSkip={() => onComplete(profileAfterColour)}
      />
    );
  }

  return (
    <div className="toki-onboard-screen">
      <div className="toki-onboard-blobs" aria-hidden="true" />
      <div className="toki-onboard-header">
        {onBack && (
          <button type="button" className="toki-back-chevron" onClick={onBack} aria-label="Back">
            ‹
          </button>
        )}
        <div className="toki-progress">
          <span className="toki-progress-label">A few favourites</span>
          <div className="toki-progress-bar">
            <span className="toki-progress-seg toki-progress-seg--filled" />
            <span className="toki-progress-seg" />
          </div>
        </div>
        <span className="toki-progress-count">Step 1 of 2</span>
      </div>

      <h2 className="toki-heading">Favourite colour</h2>
      <p className="toki-lede">
        Tap what fits, skip if you like. This is the colour the app leans on for your child.
      </p>

      <div className="toki-swatch-grid">
        {COLOURS.map((opt) => {
          const selected = favColour === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={selected ? 'toki-swatch-btn toki-swatch-btn--selected' : 'toki-swatch-btn'}
              onClick={() => setFavColour(selected ? undefined : opt.value)}
            >
              <span className={`toki-swatch-circle toki-swatch-circle--${opt.value}`} aria-hidden="true" />
              <span className="toki-swatch-label">{opt.label}</span>
              {selected && (
                <span className="toki-swatch-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="toki-footer">
        <button type="button" className="toki-cta" disabled={saving} onClick={() => void handleContinue()}>
          Next
        </button>
        <p className="toki-caption">You can, but you don&rsquo;t have to, and nothing changes if you skip it.</p>
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
