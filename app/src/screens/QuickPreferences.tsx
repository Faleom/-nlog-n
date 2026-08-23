// F.016 — Context profile: quick preferences. Tap-only, no typing
// anywhere (§6.2's "favourite place" table entry says "text or tap", but
// F.016's own Done-when is stricter — "tap-only, no typing required" — so
// place is a tappable list here too, not a text field).
//
// One category per screen, in the same minimal radio-list style as
// ResponseProfile.tsx's questions — product-owner feedback was that
// showing all six categories (colour/animal/food/place/sound/movement) at
// once, each as a grid of filled chips, read as crowded next to that
// screen's now-simpler one-question-at-a-time layout. `categoryIndex` is
// local, throwaway UI state, same reasoning as ResponseProfile's
// questionIndex — re-entering this screen always starts back at category 1.

import { useState } from 'react';
import { saveQuickPreferences, shouldAskIsCompanionStillFavourite } from '../engine/quickPreferences';
import type { ChildProfile, MotivatingMovement, QuickPreferences as QuickPreferencesType } from '../types';

interface QuickPreferencesProps {
  profile: ChildProfile;
  onComplete: (profile: ChildProfile) => void;
}

const COLOURS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
const ANIMALS = ['rabbit', 'dog', 'cat', 'elephant', 'lion', 'duck'];
const FOODS = ['banana', 'apple', 'biscuit', 'pasta', 'yoghurt'];
const PLACES = ['the kitchen', 'the living room', 'their bedroom', 'the backyard', 'the bathroom'];
const SOUNDS = ['bell', 'chime', 'giggle', 'drum', 'xylophone'];
const MOVEMENTS: MotivatingMovement[] = ['jump', 'spin', 'stomp', 'clap', 'splash'];

export function QuickPreferencesScreen({ profile, onComplete }: QuickPreferencesProps) {
  const existing = profile.context.quickPreferences ?? {};
  const [favColour, setFavColour] = useState(existing.favColour);
  const [favAnimal, setFavAnimal] = useState(existing.favAnimal);
  const [favFood, setFavFood] = useState(existing.favFood);
  const [favPlace, setFavPlace] = useState(existing.favPlace);
  const [favSound, setFavSound] = useState(existing.favSound);
  const [movement, setMovement] = useState<MotivatingMovement | undefined>(existing.movement);
  const [saving, setSaving] = useState(false);
  const [categoryIndex, setCategoryIndex] = useState(0);

  const categories: Array<{
    label: string;
    options: string[];
    value: string | undefined;
    onChange: (v: string | undefined) => void;
  }> = [
    { label: 'Favourite colour', options: COLOURS, value: favColour, onChange: setFavColour },
    { label: 'Favourite animal', options: ANIMALS, value: favAnimal, onChange: setFavAnimal },
    { label: 'Favourite food', options: FOODS, value: favFood, onChange: setFavFood },
    { label: 'Favourite place at home', options: PLACES, value: favPlace, onChange: setFavPlace },
    { label: 'Favourite sound', options: SOUNDS, value: favSound, onChange: setFavSound },
    {
      label: 'Motivating movement',
      options: MOVEMENTS,
      value: movement,
      onChange: (v) => setMovement(v as MotivatingMovement | undefined),
    },
  ];
  const total = categories.length;
  const isLastCategory = categoryIndex === total - 1;
  const current = categories[categoryIndex];

  async function handleContinue() {
    setSaving(true);
    const patch: QuickPreferencesType = { favColour, favAnimal, favFood, favPlace, favSound, movement };
    const updated = await saveQuickPreferences(profile.id, patch);
    setSaving(false);
    onComplete(updated);
  }

  return (
    <div className="screen">
      <h2>A few favourites</h2>
      <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
        Category {categoryIndex + 1} of {total}. Tap what fits, skip anything.
      </p>

      <ChipRow
        label={current.label}
        options={current.options}
        value={current.value}
        onChange={current.onChange}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        {categoryIndex > 0 && (
          <button style={{ flex: '0 1 auto' }} onClick={() => setCategoryIndex((i) => i - 1)}>
            Back
          </button>
        )}
        <button
          className="button-primary"
          style={{ flex: 1 }}
          disabled={isLastCategory && saving}
          onClick={() => (isLastCategory ? void handleContinue() : setCategoryIndex((i) => i + 1))}
        >
          {isLastCategory ? 'Continue' : 'Next'}
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
