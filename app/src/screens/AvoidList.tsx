// F.018 — Avoid list. "Anything we should stay away from?" (§6.2).
// Multi-select plus free text, defaults to empty, skippable. Wires the
// real filter into F.005's slots.ts hook on mount, so anything rendered
// after this screen loads is already covered.

import { useEffect, useState } from 'react';
import { installAvoidFilter } from '../engine/avoidFilter';
import { updateProfile } from '../engine/profileStore';
import type { AvoidList as AvoidListType, ChildProfile } from '../types';

interface AvoidListProps {
  profile: ChildProfile;
  onComplete: (profile: ChildProfile) => void;
}

const COLOUR_SWATCHES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

export function AvoidListScreen({ profile, onComplete }: AvoidListProps) {
  const existing = profile.context.avoidList ?? {};
  const [loudSounds, setLoudSounds] = useState(existing.loudSounds ?? false);
  const [fastAnimation, setFastAnimation] = useState(existing.fastAnimation ?? false);
  const [surprises, setSurprises] = useState(existing.surprises ?? false);
  const [avoidedColour, setAvoidedColour] = useState(existing.avoidedColour ?? '');
  const [termsText, setTermsText] = useState((existing.avoidedTerms ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    installAvoidFilter();
  }, []);

  async function handleContinue() {
    setSaving(true);
    const avoidedTerms = termsText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const avoidList: AvoidListType = {
      loudSounds,
      fastAnimation,
      surprises,
      avoidedColour: avoidedColour === '' ? undefined : avoidedColour,
      avoidedTerms,
    };
    const updated = await updateProfile(profile.id, { context: { avoidList } });
    setSaving(false);
    onComplete(updated);
  }

  return (
    <div className="screen">
      <h2>Anything we should stay away from?</h2>

      <ToggleRow label="Loud or sudden sounds" value={loudSounds} onChange={setLoudSounds} />
      <ToggleRow label="Fast animation or flashing" value={fastAnimation} onChange={setFastAnimation} />
      <ToggleRow label="Surprises and unannounced changes" value={surprises} onChange={setSurprises} />

      <p>A colour they dislike</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {COLOUR_SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => setAvoidedColour(avoidedColour === c ? '' : c)}
            style={{
              background: avoidedColour === c ? '#333' : 'white',
              color: avoidedColour === c ? 'white' : 'black',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        Words or topics that upset them (comma separated, optional)
        <textarea
          value={termsText}
          onChange={(e) => setTermsText(e.target.value)}
          style={{ minHeight: 44, fontSize: '1rem' }}
        />
      </label>

      <button disabled={saving} onClick={() => void handleContinue()}>
        Continue
      </button>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        background: value ? '#333' : 'white',
        color: value ? 'white' : 'black',
        textAlign: 'left',
      }}
    >
      {value ? '✓ ' : ''}
      {label}
    </button>
  );
}
