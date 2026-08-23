// F.004 — Companion capture. §6.3 calls this the single strongest feature
// in the product: the child's favourite toy, photographed and named,
// becomes the app's character.
//
// Skippable, falling back to a neutral guide (§6.6) — the slot system
// already defaults `{companion}`/`{companion_they}` to "your friend"/
// "they" when no Companion is set (see engine/slots.ts), so skipping here
// needs no special-casing downstream. Editable later from settings with
// no re-onboarding: this component is just as valid called again from a
// settings screen as it is at onboarding.

import { useState } from 'react';
import { adapters } from '../adapters/registry';
import {
  COMPANION_REJECTION_MESSAGE,
  detectFaceInCompanionPhoto,
  saveCompanion,
} from '../engine/companionCapture';
import type { ChildProfile, Companion } from '../types';

interface CompanionCaptureProps {
  profile: ChildProfile;
  onComplete: (profile: ChildProfile) => void;
  onSkip: () => void;
}

type Stage = 'intro' | 'rejected' | 'details';

const PRONOUNS: Array<{ value: Companion['pronoun']; label: string }> = [
  { value: 'he', label: 'He' },
  { value: 'she', label: 'She' },
  { value: 'they', label: 'They' },
  { value: 'it', label: 'It' },
];

async function imageBitmapToDataUrl(image: ImageBitmap): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function CompanionCapture({ profile, onComplete, onSkip }: CompanionCaptureProps) {
  const [stage, setStage] = useState<Stage>('intro');
  const [busy, setBusy] = useState(false);
  const [pendingImage, setPendingImage] = useState<ImageBitmap | null>(null);
  const [pendingDataUrl, setPendingDataUrl] = useState('');
  const [name, setName] = useState('');
  const [pronoun, setPronoun] = useState<Companion['pronoun']>('they');

  async function handleTakePhoto() {
    setBusy(true);
    const image = await adapters.capture.capturePhoto();
    const hasFace = await detectFaceInCompanionPhoto(image);
    if (hasFace) {
      setStage('rejected');
      setBusy(false);
      return;
    }
    const dataUrl = await imageBitmapToDataUrl(image);
    setPendingImage(image);
    setPendingDataUrl(dataUrl);
    setStage('details');
    setBusy(false);
  }

  async function handleSaveDetails() {
    if (!pendingImage || name.trim() === '') return;
    setBusy(true);
    const updated = await saveCompanion(profile.id, pendingDataUrl, name, pronoun);
    setBusy(false);
    onComplete(updated);
  }

  if (stage === 'rejected') {
    return (
      <div className="screen">
        <p>{COMPANION_REJECTION_MESSAGE}</p>
        <button
          onClick={() => {
            setStage('intro');
          }}
        >
          Try again
        </button>
        <button onClick={onSkip}>Skip for now</button>
      </div>
    );
  }

  if (stage === 'details') {
    return (
      <div className="screen">
        {pendingDataUrl && (
          <img
            src={pendingDataUrl}
            alt="Companion preview"
            style={{ maxWidth: '100%', borderRadius: 12 }}
          />
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          What&rsquo;s their name?
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bunbun"
            style={{ minHeight: 44, fontSize: '1rem' }}
          />
        </label>
        <p>Pronoun</p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PRONOUNS.length}, 1fr)`, gap: 8 }}>
          {PRONOUNS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPronoun(p.value)}
              style={{
                background: pronoun === p.value ? 'var(--color-primary)' : 'var(--color-surface)',
                color: pronoun === p.value ? 'var(--color-primary-ink)' : 'var(--color-ink)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button disabled={busy || name.trim() === ''} onClick={() => void handleSaveDetails()}>
          Save
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h2>Their favourite toy</h2>
      <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
        Photograph a favourite toy or comfort object on its own. No people in the photo.
      </p>
      <button disabled={busy} onClick={() => void handleTakePhoto()}>
        Take a photo
      </button>
      <button onClick={onSkip}>Skip for now</button>
    </div>
  );
}
