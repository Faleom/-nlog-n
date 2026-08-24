// F.020 — the neutral note prompt, meant to be embedded anywhere in
// Branch 1 that a caregiver might want to flag something for later
// (a game screen, the dashboard, a support-tier report). Identical
// everywhere it appears -- see engine/branchHandoff.ts for the guarantee
// this renders.
//
// Deliberately has no prop that could vary the QUESTION shown. `history` is
// accepted and passed straight through to getNeutralNotePromptState, which
// ignores it -- see that module for why, and scripts/smoke-f020.ts for the
// real round-trip proof. Switching between "yes, save a note" and "no" here
// never shows a confirmation dialog -- see §10's "asks nothing, warns
// nothing" requirement.
//
// Toki revamp: no mockup covers this prompt (the source file's own footer
// leaves the Notes tab and the worry-to-question branch out), so it carries
// the light card/button vocabulary the revamped screens already share,
// same as CompanionCapture did for onboarding. Both answers carry the one
// identical button class, which is the §10 rule above made literal.

import { getNeutralNotePromptState } from '../engine/branchHandoff';
import type { SkillRecord } from '../types';

interface NeutralNotePromptProps {
  /** Whatever activity history the caller has on hand, if any. Ignored by
   * design -- see engine/branchHandoff.ts. */
  history?: SkillRecord[];
  onSaveNote: () => void;
  onDismiss: () => void;
}

export function NeutralNotePrompt({ history = [], onSaveNote, onDismiss }: NeutralNotePromptProps) {
  const { text } = getNeutralNotePromptState(history);
  return (
    <div className="neutral-note-prompt">
      <p>{text}</p>
      {/* Both buttons carry the identical .toki-secondary-btn and are
          equal-width by design -- styling that made either answer look
          like the expected one would break §10. The touch floor comes from
          that shared class, so it needs no restating inline here. */}
      <div className="neutral-note-prompt-actions">
        <button className="toki-secondary-btn" onClick={onSaveNote}>
          Yes, save a note
        </button>
        <button className="toki-secondary-btn" onClick={onDismiss}>
          No
        </button>
      </div>
    </div>
  );
}
