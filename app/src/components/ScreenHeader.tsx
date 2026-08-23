// Wayfinding chrome. Every screen except the two true roots (onboarding,
// branch1Home) renders one of these above its own content. It answers three
// questions a caregiver asks when they're lost: which flow am I in, how do
// I get back, and — for the one-time setup chain — how much is left.
//
// Deliberately does not repeat the screen's own <h2>; screens already state
// what they are, this states where that fits in the app.

interface ScreenHeaderProps {
  eyebrow: string;
  onBack?: () => void;
  backLabel?: string;
  step?: { current: number; total: number };
}

export function ScreenHeader({ eyebrow, onBack, backLabel, step }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      {onBack ? (
        <button
          type="button"
          className="header-back"
          onClick={onBack}
          aria-label={backLabel ?? 'Back'}
        >
          <span aria-hidden="true" className="header-back-arrow">
            ←
          </span>
          <span className="header-back-label">{backLabel ?? 'Back'}</span>
        </button>
      ) : (
        <div className="header-back-spacer" aria-hidden="true" />
      )}

      <div className="header-meta">
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
