// Persistent app identity bar. Unlike ScreenHeader (which answers "which
// flow / how do I get back"), this answers "what app is this" -- the kind
// of top-level identity strip a real installed app has, present across
// (most) screens rather than only contextual chrome.
//
// STATUS.md lists "Project name" as a still-open, undecided product
// decision -- it would be wrong for a UI pass to lock one in. This renders
// a single placeholder glyph + label rather than a real wordmark; swap
// APP_NAME_PLACEHOLDER for the real name in this one place once it's
// picked, or drop back to icon-only by removing the <span> below it.
//
// Not a button, not interactive -- carries none of the touch-target rules,
// and never speaks (icons/photos/audio for the child; this is caregiver
// wayfinding chrome). App.tsx suppresses it during a game's child-facing
// phase using the exact same `childFacing` flag that suppresses
// ScreenHeader, via GameChrome -- see App.tsx.
const APP_NAME_PLACEHOLDER = 'Early Learning Companion';

export function AppHeader() {
  return (
    <header className="app-header" aria-label="App">
      <span className="app-header-mark" aria-hidden="true">
        🌱
      </span>
      <span className="app-header-name">{APP_NAME_PLACEHOLDER}</span>
    </header>
  );
}
