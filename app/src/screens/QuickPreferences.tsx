// F.016 — Context profile: quick preferences. Tap-only, no typing
// anywhere (§6.2's "favourite place" table entry says "text or tap", but
// F.016's own Done-when is stricter — "tap-only, no typing required" — so
// place is a tappable list here too, not a text field).

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
      <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Tap what fits. Skip anything.</p>

      <ChipRow label="Favourite colour" options={COLOURS} value={favColour} onChange={setFavColour} />
      <ChipRow label="Favourite animal" options={ANIMALS} value={favAnimal} onChange={setFavAnimal} />
      <ChipRow label="Favourite food" options={FOODS} value={favFood} onChange={setFavFood} />
      <ChipRow label="Favourite place at home" options={PLACES} value={favPlace} onChange={setFavPlace} />
      <ChipRow label="Favourite sound" options={SOUNDS} value={favSound} onChange={setFavSound} />
      <ChipRow
        label="Motivating movement"
        options={MOVEMENTS}
        value={movement}
        onChange={(v) => setMovement(v as MotivatingMovement)}
      />

      <button disabled={saving} onClick={() => void handleContinue()}>
        Continue
      </button>
    </div>
  );
}

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(value === opt ? undefined : opt)}
            style={{
              background: value === opt ? '#333' : 'white',
              color: value === opt ? 'white' : 'black',
            }}
          >
            {opt}
          </button>
        ))}
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
