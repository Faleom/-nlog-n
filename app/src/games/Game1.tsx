// Game 1 — Find It In Your World. WALKING SKELETON, not the real thing.
//
// Proves the wiring end to end: a real profile (F.001) -> real slot
// rendering through the avoid-filter hook (F.005) -> fixture crops -> a
// target prompt -> caregiver "They brought it" -> child confirmation grid
// -> tap. F.008 (owned by P2) replaces this with the real loop: real
// crops from F.006, real state machine from F.009, real support ladder
// from F.010.
//
// Deliberately thin: no support tiers, no prompt hierarchy, no session
// logging yet — those are F.009/F.010, which need F.008 to exist first.

import { useState } from 'react';
import { adapters } from '../adapters/registry';
import { renderLine, slotValuesFromProfile } from '../engine/slots';
import type { ChildProfile, TaggedCrop } from '../types';

type Phase = 'searching' | 'confirming' | 'celebrating';

interface Game1Props {
  profile: ChildProfile;
}

export function Game1({ profile }: Game1Props) {
  const [crops, setCrops] = useState<TaggedCrop[]>([]);
  const [target, setTarget] = useState<TaggedCrop | null>(null);
  const [phase, setPhase] = useState<Phase>('searching');
  const [loaded, setLoaded] = useState(false);

  async function loadRoom() {
    // Placeholder: in the real F.008 this comes from a captured + processed
    // photo. Here we just call the fixture VisionPort directly to prove the
    // adapter boundary works.
    const objects = await adapters.vision.recognizeObjects(
      await adapters.capture.capturePhoto(),
    );
    const picked = objects[Math.floor(Math.random() * objects.length)];
    setCrops(objects);
    setTarget(picked);
    setLoaded(true);

    const line = renderLine(
      '{companion} wants something {fav_colour}!',
      slotValuesFromProfile(profile, { fav_colour: picked.colour }),
      profile.context,
    );
    void adapters.speechOut.say(line);
  }

  function handleTheyBroughtIt() {
    setPhase('confirming');
  }

  function handleTap(crop: TaggedCrop) {
    if (crop.id === target?.id) {
      setPhase('celebrating');
      const line = renderLine(
        'Your {object.name}!',
        slotValuesFromProfile(profile, { 'object.name': crop.name }),
        profile.context,
      );
      void adapters.speechOut.say(line);
    }
    // Wrong-tap handling (silence + fade, per §7.7) belongs to F.009 — not
    // implemented in this skeleton.
  }

  if (!loaded) {
    return (
      <div className="screen">
        <h2>Game 1 — walking skeleton</h2>
        <button onClick={loadRoom}>Load room (fixture)</button>
      </div>
    );
  }

  return (
    <div className="screen">
      {phase === 'searching' && (
        <>
          <p>Caregiver view: find something {target?.colour}.</p>
          <button style={{ minWidth: 88, minHeight: 88 }} onClick={handleTheyBroughtIt}>
            They brought it
          </button>
        </>
      )}

      {phase === 'confirming' && (
        <>
          <p>Show me — which one did you bring?</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {crops.map((crop) => (
              <button
                key={crop.id}
                style={{ minWidth: 88, minHeight: 88 }}
                onClick={() => handleTap(crop)}
              >
                {crop.name}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'celebrating' && <p>🎉 Your {target?.name}!</p>}
    </div>
  );
}
