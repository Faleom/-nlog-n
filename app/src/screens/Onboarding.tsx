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
// Not wired into App.tsx's top-level flow here — per the brief, someone
// else does the final routing. This is a real, working, standalone screen.

import { useState } from 'react';
import { createProfile } from '../engine/profileStore';
import { parseAgeMonths, type Branch } from '../engine/onboarding';
import type { ChildProfile } from '../types';

interface OnboardingProps {
  onComplete: (profile: ChildProfile, branch: Branch) => void;
}

type Step = 'age' | 'doors';

export function Onboarding({ onComplete }: OnboardingProps) {
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
      <div className="screen">
        <h1>Let&rsquo;s get started</h1>
        <p style={{ color: 'var(--color-ink-muted)' }}>
          Just enough to tailor things to your child — nothing else, yet.
        </p>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          Child&rsquo;s age, in months
          <input
            type="number"
            inputMode="numeric"
            value={ageInput}
            onChange={(e) => setAgeInput(e.target.value)}
            placeholder="e.g. 42"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          Nickname (optional)
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Maya"
          />
        </label>
        <button
          className="button-primary"
          disabled={ageMonths === null}
          onClick={() => setStep('doors')}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>What brings you here?</h1>
      <p style={{ color: 'var(--color-ink-muted)' }}>Either one is a good place to start.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button disabled={creating} onClick={() => void handleChooseBranch('my-world')}>
          I want activities for my child
        </button>
        <button disabled={creating} onClick={() => void handleChooseBranch('worry-to-question')}>
          I&rsquo;ve been thinking about my child&rsquo;s development
        </button>
      </div>
    </div>
  );
}
