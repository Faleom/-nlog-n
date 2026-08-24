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
//
// Toki revamp: no mockup screen covers this one (the source file stops at
// Quick preferences' page 1). Carries the same toki-onboard-* chrome as
// the rest of the flow instead of inventing a different look for page 2
// of the same screen.

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
  onBack?: () => void;
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

function CompanionHeader({ onBack }: { onBack?: () => void }) {
  return (
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
          <span className="toki-progress-seg toki-progress-seg--filled" />
        </div>
      </div>
      <span className="toki-progress-count">Step 2 of 2</span>
    </div>
  );
}

export function CompanionCapture({ profile, onComplete, onSkip, onBack }: CompanionCaptureProps) {
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
      <div className="toki-onboard-screen">
        <div className="toki-onboard-blobs" aria-hidden="true" />
        <CompanionHeader onBack={onBack} />
        <h2 className="toki-heading">Let&rsquo;s use something else</h2>
        <p className="toki-lede">{COMPANION_REJECTION_MESSAGE}</p>
        <div className="toki-footer">
          <div className="toki-footer-row">
            <button type="button" className="toki-secondary-btn" onClick={onSkip}>
              Skip for now
            </button>
            <button type="button" className="toki-cta" onClick={() => setStage('intro')}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'details') {
    return (
      <div className="toki-onboard-screen">
        <div className="toki-onboard-blobs" aria-hidden="true" />
        <CompanionHeader onBack={() => setStage('intro')} />
        <h2 className="toki-heading">Tell us about them</h2>
        {pendingDataUrl && (
          <img src={pendingDataUrl} alt="Companion preview" className="toki-photo-preview" />
        )}
        <div className="toki-card">
          <label className="toki-field">
            <span className="toki-field-label">What&rsquo;s their name?</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bunbun"
            />
          </label>
          <div className="toki-field">
            <span className="toki-field-label">Pronoun</span>
            <div className="toki-segmented" style={{ gridTemplateColumns: `repeat(${PRONOUNS.length}, 1fr)` }}>
              {PRONOUNS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={pronoun === p.value ? 'toki-segment toki-segment--selected' : 'toki-segment'}
                  onClick={() => setPronoun(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="toki-footer">
          <button
            type="button"
            className="toki-cta"
            disabled={busy || name.trim() === ''}
            onClick={() => void handleSaveDetails()}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="toki-onboard-screen">
      <div className="toki-onboard-blobs" aria-hidden="true" />
      <CompanionHeader onBack={onBack} />
      <h2 className="toki-heading">Their favourite toy</h2>
      <p className="toki-lede">
        Photograph a favourite toy or comfort object on its own. No people in the photo.
      </p>
      <div className="toki-footer">
        <div className="toki-footer-row">
          <button type="button" className="toki-secondary-btn" onClick={onSkip}>
            Skip for now
          </button>
          <button type="button" className="toki-cta" disabled={busy} onClick={() => void handleTakePhoto()}>
            Take a photo
          </button>
        </div>
      </div>
    </div>
  );
}
