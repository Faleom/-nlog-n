// F.002 — Shared onboarding: age, nickname, two equal doors.
// See app-guide-v3-FINAL.md §5.1.
//
// Deliberately two short steps, nothing else: age (the only required
// field) + optional nickname, then two doors of EQUAL visual weight. No
// diagnosis, condition or developmental question anywhere in this file —
// that question never belongs at this altitude (§5.1, §13). This screen
// creates the profile (via F.001's createProfile) once a door is picked;
// F.003/F.004 fill in everything else afterward.
//
// Toki revamp (screens 2-3 of the mockup): same two steps, restyled onto
// the shared toki-onboard-* chrome from App.css. onBack is optional so
// this component still works standalone (per the original brief) — App.tsx
// wires it to return to the welcome screen from step 1.

import { useState } from 'react';
import { createProfile } from '../engine/profileStore';
import { parseAgeMonths, type Branch } from '../engine/onboarding';
import type { ChildProfile } from '../types';

interface OnboardingProps {
  onComplete: (profile: ChildProfile, branch: Branch) => void;
  onBack?: () => void;
}

type Step = 'age' | 'doors';

export function Onboarding({ onComplete, onBack }: OnboardingProps) {
  const [step, setStep] = useState<Step>('age');
  const [ageInput, setAgeInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [creating, setCreating] = useState(false);

  const ageMonths = parseAgeMonths(ageInput);

  async function handleChooseBranch(branch: Branch) {
    if (ageMonths === null || creating) return;
    setCreating(true);
    const profile = await createProfile({
      ageMonths,
      nickname: nickname.trim() === '' ? undefined : nickname.trim(),
    });
    setCreating(false);
    onComplete(profile, branch);
  }

  if (step === 'age') {
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
            <span className="toki-progress-label">Setting up your child&rsquo;s profile</span>
            <div className="toki-progress-bar">
              <span className="toki-progress-seg toki-progress-seg--filled" />
              <span className="toki-progress-seg" />
            </div>
          </div>
          <span className="toki-progress-count">1 of 2</span>
        </div>
        <h1 className="toki-heading">Let&rsquo;s get started</h1>
        <p className="toki-lede">Just enough to tailor things to your child. Nothing else, yet.</p>
        <div className="toki-card">
          <label className="toki-field">
            <span className="toki-field-label">Child&rsquo;s age, in months</span>
            <input
              type="number"
              inputMode="numeric"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              placeholder="e.g. 42"
            />
          </label>
          <label className="toki-field">
            <span className="toki-field-label">Nickname (optional)</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Maya"
            />
          </label>
        </div>
        <p className="toki-hint">
          Age lets us pitch the activities. The nickname only ever appears on this device.
        </p>
        <div className="toki-footer">
          <button
            type="button"
            className="toki-cta"
            disabled={ageMonths === null}
            onClick={() => setStep('doors')}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="toki-onboard-screen">
      <div className="toki-onboard-blobs" aria-hidden="true" />
      <div className="toki-onboard-header">
        <button
          type="button"
          className="toki-back-chevron"
          onClick={() => setStep('age')}
          aria-label="Back"
        >
          ‹
        </button>
        <div className="toki-progress">
          <span className="toki-progress-label">Setting up your child&rsquo;s profile</span>
          <div className="toki-progress-bar">
            <span className="toki-progress-seg toki-progress-seg--filled" />
            <span className="toki-progress-seg toki-progress-seg--filled" />
          </div>
        </div>
        <span className="toki-progress-count">2 of 2</span>
      </div>
      <h1 className="toki-heading">What brings you here?</h1>
      <p className="toki-lede">Either one is a good place to start.</p>
      <div className="toki-choice-list">
        <button
          type="button"
          className="toki-choice-tile"
          disabled={creating}
          onClick={() => void handleChooseBranch('my-world')}
        >
          <span className="toki-choice-icon toki-choice-icon--blue" aria-hidden="true">
            🎈
          </span>
          <span className="toki-choice-copy">
            <span className="toki-choice-title">I want activities for my child</span>
            <span className="toki-choice-sub">
              Photograph a room, get things to do with what&rsquo;s in it.
            </span>
          </span>
        </button>
        <button
          type="button"
          className="toki-choice-tile"
          disabled={creating}
          onClick={() => void handleChooseBranch('worry-to-question')}
        >
          <span className="toki-choice-icon toki-choice-icon--purple" aria-hidden="true">
            📝
          </span>
          <span className="toki-choice-copy">
            <span className="toki-choice-title">
              I&rsquo;ve been thinking about my child&rsquo;s development
            </span>
            <span className="toki-choice-sub">Turn a worry into one clear question to ask.</span>
          </span>
        </button>
      </div>
      <p className="toki-hint" style={{ marginTop: 'auto', paddingBottom: 24 }}>
        You can do both. Nothing here labels or evaluates your child.
      </p>
    </div>
  );
}
