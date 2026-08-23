// Wayfinding chrome. Every screen except the two true roots (onboarding,
// branch1Home) renders one of these above its own content. It answers three
// questions a caregiver asks when they're lost: which flow am I in, how do
// I get back, and — for the one-time setup chain — how much is left.
//
// Deliberately does not repeat the screen's own <h2>; screens already state
// what they are, this states where that fits in the app.
//
// On a screen with no back button the row used to open with an 88px
// invisible spacer, which pushed the eyebrow ~100px in while the heading
// underneath it started at the content edge -- the eyebrow read as
// half-centred by accident. There is no spacer now: with nothing to go back
// to, the eyebrow simply starts where the rest of the page starts.

interface ScreenHeaderProps {
  eyebrow: string;
  onBack?: () => void;
  backLabel?: string;
  step?: { current: number; total: number };
}

export function ScreenHeader({ eyebrow, onBack, backLabel, step }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      {onBack && (
        // Hit slop: the <button> is the 88x88 touch target UI-STANDARDS
        // requires and draws nothing at all; the inner chip is the small
        // visible control, centred inside it. See .header-back /
        // .header-back-chip in App.css -- the two sizes are deliberately
        // decoupled, so do not move the decoration back onto the button to
        // "simplify" this.
        <button
          type="button"
          className="header-back"
          onClick={onBack}
          aria-label={backLabel ?? 'Back'}
        >
          <span className="header-back-chip">
            <span aria-hidden="true" className="header-back-arrow">
              ←
            </span>
            <span className="header-back-label">{backLabel ?? 'Back'}</span>
          </span>
        </button>
      )}

      {/* The "Step N of 4" readout (onboarding chain only) reads as its own
          small unit -- eyebrow, step line, progress bar -- with nothing
          else sharing this row (no back button on these screens). Centered
          it reads as one deliberate block instead of text stranded at the
          left edge of an otherwise-empty row; screens without a step just
          get the plain left-aligned eyebrow they always have. */}
      <div className={step ? 'header-meta header-meta--centered' : 'header-meta'}>
        <p className="header-eyebrow">{eyebrow}</p>
        {step && (
          <>
            <p className="header-step">
              Step {step.current} of {step.total}
            </p>
            <div
              className="header-progress"
              role="progressbar"
              aria-valuenow={step.current}
              aria-valuemin={1}
              aria-valuemax={step.total}
              aria-label={`Setup progress: step ${step.current} of ${step.total}`}
            >
              <div
                className="header-progress-fill"
                style={{ width: `${(step.current / step.total) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
