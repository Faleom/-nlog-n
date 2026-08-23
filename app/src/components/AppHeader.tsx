// Persistent app identity bar. Unlike ScreenHeader (which answers "which
// flow / how do I get back"), this answers "what app is this" -- the kind
// of top-level identity strip a real installed app has, present across
// (most) screens rather than only contextual chrome.
//
// The product name is "Hello World". It is written in exactly three other
// places -- index.html's <title> and the PWA manifest's name/short_name in
// vite.config.ts -- so keep those in step with this constant.
//
// Note: "My World" is the internal name of Branch 1. It used to be prefixed
// onto header eyebrows ("MY WORLD · PLAY") and was removed as redundant --
// this pill is the app's identity, the eyebrow/heading say where you are.
// Don't reintroduce it as chrome.
//
// Not a button, not interactive -- carries none of the touch-target rules,
// and never speaks. Deliberate product decision: unlike ScreenHeader (back
// button + flow eyebrow, real interactive chrome), this stays visible even
// during a game's child-facing phase -- GameChrome in App.tsx renders it
// unconditionally so the app never reads as unbranded while a child is
// playing, while ScreenHeader stays gated on `childFacing` since it's the
// interactive half of the original zero-chrome rule.
const APP_NAME = 'Hello World';

export function AppHeader() {
  return (
    <header className="app-header" aria-label="App">
      <span className="app-header-mark" aria-hidden="true">
        🌱
      </span>
      <span className="app-header-name">{APP_NAME}</span>
    </header>
  );
}
