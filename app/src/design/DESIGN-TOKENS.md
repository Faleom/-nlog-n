# Design tokens — dark-first liquid glass, with a light alternative

**Status: LOCKED (Phase 1 palette) + Phase 3 (light theme).** This document is
the single source of truth for the visual system. `src/App.css`'s `:root`
block is the implementation of what is written here; `src/design/fonts.css`
is the font delivery. If a value changes, it changes here first.

Dark is **the default**. It is this app's deliberate identity, chosen for this
audience, and it is what renders with no `[data-theme]` attribute set at all —
see `:root` in `src/App.css`. A caregiver can switch to a genuinely designed
light theme from the Setup tab; that choice sets `[data-theme="light"]` on
`<html>` and is read back from `:root[data-theme='light']` in `src/App.css`,
persisted via `src/engine/themePreference.ts`. There is still no
`prefers-color-scheme` branch anywhere — the OS setting never silently
overrides the caregiver's own explicit choice. §9 below documents the light
palette; every section before it describes dark, which remains the primary,
most-considered mode.

Three references govern the system: Duolingo (one thing at a time, low cognitive
load), Apple's liquid glass (translucent, layered, softly refractive), and a
genuinely child-legible typeface. Two audiences — child and caregiver — share
one material system, differing in **density and temperature**, never in kind.

---

## 1. Palette

### 1.1 Ground — six values

Hue ~265 (violet-plum) held at very low saturation, warming toward ivory at the
light end. Not a blue-black, not a neutral grey.

| Token                    | Name       | Hex       | Used for |
| ------------------------ | ---------- | --------- | -------- |
| `--color-surface-sunken` | Pitch      | `#0E0C13` | The page behind the app's 480px "device". The deepest thing on screen. |
| `--color-bg`             | Nightshade | `#16121D` | The app's own ground. Every contrast figure below is measured against this. |
| `--color-surface`        | Slate Plum | `#241E2E` | Raised solid surface, and the `@supports` fallback behind every glass panel. |
| `--color-ink`            | Moonmilk   | `#F4EFE8` | Primary text/icons. Warm ivory. |
| `--color-ink-muted`      | Haze       | `#A79CB5` | Secondary text, labels, captions. |
| `--color-border`         | Seam       | `#453B54` | Decorative hairlines, dividers, progress-track. |
| `--color-border-strong`  | Reed       | `#7A6C92` | **Functional** boundaries — input fields, the no-backdrop-filter fallback border. |

**Why Moonmilk and not `#FFFFFF`.** Pure white on a near-black ground halates —
the strokes bloom and smear, which is worst for exactly the reader we care about
(a 3–5 year old, often at arm's length, often at night). `#F4EFE8` is warm,
drops the glare, and still measures 16.13:1 on Nightshade.

**Why two border tokens.** Seam is 1.76:1 on Nightshade — correct for a
decorative hairline, far too faint to bound an input field. Reed is 3.85:1 on
Nightshade and 3.22:1 on `--glass-bg`, clearing the 3:1 non-text minimum on both.
The light-mode system got away with one border token; dark does not.

### 1.2 Interactive

| Token                    | Name            | Hex / value                  | Used for |
| ------------------------ | --------------- | ---------------------------- | -------- |
| `--color-primary`        | Periwink        | `#8B7BFF`                    | Structural interactive hue. Fills, focus borders, progress fill, eyebrows on the app ground. |
| `--color-primary-bright` | Periwink Bright | `#A99DFF`                    | The same role **on `--glass-bg-strong`**, where Periwink drops to 4.03:1. |
| `--color-primary-ink`    | —               | `#171226`                    | Text/icons **on** a Periwink fill. |
| `--color-primary-soft`   | —               | `rgba(139,123,255,0.24)`     | Focus halo, selected-state wash. Translucent so it works both as a background layer and as a `box-shadow` ring. |
| `--color-accent`         | Ember           | `#FFB067`                    | Everyday warmth: accent buttons, callout borders, child-side highlights. |
| `--color-accent-soft`    | Ember Ash       | `#2E2016`                    | Tinted dark surface for accent cards. |
| `--color-accent-ink`     | —               | `#2A1405`                    | Text on a solid Ember fill (9.71:1). |

**Periwink is a re-pitch, not an inversion.** Light mode's `#5B52E8` sat *under*
the paper. On a dark ground the interactive hue has to come *toward* the light or
it disappears, so Periwink is lighter and slightly less saturated.

**The primary button flips polarity.** On dark, `.button-primary` is a *light*
violet fill with *dark* ink. This is not a style preference — white-on-Periwink
measures **2.88:1** and fails outright, while `--color-primary-ink` on Periwink
measures **5.5:1**. Anyone tempted to "restore" white text on the primary button
should read this line first.

### 1.3 Reserved saturation

These are the only fully saturated hues in the system. They are never chrome,
never a default state, and never used twice on one screen.

| Token                    | Name  | Hex / value              | Used for |
| ------------------------ | ----- | ------------------------ | -------- |
| `--color-reward`         | Sunburst | `#FFC93C`             | Reward beats only — the moment a child gets it right. |
| `--color-reward-ink`     | —     | `#2A1D02`                | Text on a Sunburst fill (10.72:1). |
| `--color-reward-glow`    | —     | `rgba(255,201,60,0.34)`  | The bloom around a rewarded Room Frame. |
| `--color-companion`      | Blush | `#FF7E9D`                | The Companion's rim and halo. |
| `--color-companion-glow` | —     | `rgba(255,126,157,0.30)` | The Companion's bloom. |

**Why the everyday palette is this restrained.** Game1 already injects the
child's own favourite colour as `--g1-accent` — an arbitrary saturated hue we do
not control, chosen at onboarding. A system carrying four or five loud hues of
its own would fight that colour every session. One cool structural hue
(Periwink) plus a warm family (Ember → Sunburst → Blush) leaves the child's
colour room to be the loudest thing on screen, which is the point.

### 1.4 Utility surfaces

Added so Phase 2 has somewhere to send the light-mode literals still hardcoded in
the games and screens (see §7).

| Token                 | Hex / value              | Replaces |
| --------------------- | ------------------------ | -------- |
| `--color-danger`      | `#FF8A80` (8.08:1)       | `#a33` error text |
| `--color-danger-soft` | `#33191C`                | error panel backgrounds |
| `--color-info-soft`   | `#1E1B33`                | `#eef` note/suggestion panels |
| `--color-tile`        | `#F0EAF5`                | `#ffffff` object-crop backing |
| `--color-tile-ink`    | `#241E2E` (13.68:1)      | text on a crop tile |
| `--color-tile-border` | `rgba(255,255,255,0.86)` | `2px solid #fff` crop outlines |

**`--color-tile` stays light on purpose.** A photographed toy on a lit tile
against the dark ground is the Room Frame idea at thumbnail scale: it reads as an
object under a lamp. Darkening it would turn every crop into a hole punched in
the UI. Do not "fix" this.

### 1.5 How this avoids the brief's named failure modes

- **Not "medical dark blue."** The ground is hue ~265 plum, not ~215 navy, and it
  carries warm ivory ink rather than cool white. Nothing in the system uses a
  cyan/steel accent.
- **Not "kids-app rainbow-on-black."** Four hues total, three of them in one warm
  family. No green, no cyan, no primary red. Saturation is rationed (§1.3).
- **Not light-mode-inverted.** Every value was chosen against the dark ground, not
  computed from the light one: the primary button flipped polarity, the border
  token split in two, the ink went warm-off-white, the ambient gradient became
  emissive (§3.3), and the shadows became near-black and much larger (§3.2).

---

## 2. Typography

**Superseded, product decision:** the original two-face split below (Andika /
Inter) shipped in Phase 1 and Phase 2, but `.child-face` was never actually
wired onto any screen — every child-facing phase in the app is icons/photos/
audio only (UI-STANDARDS' "zero text in the child's view"), so the literacy
face had no real on-screen footprint. The caregiver-facing majority of the
app (Setup, the quiz, the dashboard, the tab bar) read as a plain enterprise
form tool as a result. Explicit call: **one face now, Nunito**, everywhere.
`--font-child` / `--font-caregiver` still exist as separate tokens (so a
future screen-specific need doesn't require re-touching every consumer) but
both now resolve to the same family — see §2.1a. §2.1/§2.2 below are kept as
the historical record of the original literacy-face reasoning, in case a
real on-screen child-reading need shows up later and this gets revisited.

### 2.1a Current face — **Nunito** (variable weight axis)

`--font-child` / `--font-caregiver`:
`'Nunito Variable', 'Nunito', ...system stack, sans-serif`

- Rounded, warm terminals without going fully geometric/display — reads as
  friendly rather than corporate, without the letterform ambiguity a truly
  geometric face (Quicksand, Comfortaa) introduces at UI text sizes.
- **Wide variable weight axis (200–1000)**, the same shape as Inter's own
  range — this is what still lets `--weight-caregiver-body: 420` /
  `--weight-caregiver-strong: 620` exist (a static-weight package could only
  give 400 or 600), so it holds up as small, dense text on the dashboard and
  Setup screens, not just as a display face.
- Not a literacy face — double-story `a`, ordinary `g`. If a screen is ever
  built where the CHILD is actually reading text on their own (not the case
  anywhere in the app today), revisit §2.1's Andika reasoning before assuming
  Nunito is adequate there.
- Delivery: `@fontsource-variable/nunito`, same offline-safe pattern as
  before (see §2.3) — one `.woff2`, latin subset only, self-hosted, precached.

### 2.1 (historical) Child face — **Andika** (SIL International), 400 / 700

`--font-child: 'Andika', 'Trebuchet MS', system-ui, sans-serif`

Andika was drawn by SIL International specifically for **literacy materials and
beginning readers**, which is the actual reason it is here and the reason it beat
every "fun rounded display face."

Verified against the shipped `andika-latin-*.woff2` files with fontTools, not
assumed:

- **Single-story `a` and single-bowl `g` are the defaults.** The glyphs the cmap
  maps `U+0061` and `U+0067` to are literally named `a.SngStory` and `g.SngBowl`.
  A 3–5 year old is learning the handwritten forms; the double-story `a` and
  binocular `g` of a normal UI face are shapes they have never been taught.
- **Letterform disambiguation.** `I`, `l` and `1` are drawn to be unmistakable —
  the capital has crossbars, the lowercase `l` has a tail, the `1` has a flag and
  a base. Same for `0`/`O`. This is the criterion that eliminates geometric
  rounded faces, whose circular construction makes `b/d/p/q` near mirror images.
- **Metrics:** unitsPerEm 2048, x-height 1040 (0.508 em), cap-height 1485
  (x/cap 0.70). Advance width of `n` is 1185 (0.579 em) — naturally wide, so the
  generous tracking the brief asks for is mostly built into the face; we add only
  `--tracking-child: 0.012em` on top.
- **Terminals are softened, not geometrically rounded.** Being honest about this:
  Andika's stroke ends are gently flared and cut rather than ball-terminal round.
  The toy-like warmth in this product comes from the *material* — glass, bloom,
  Ember, the child's own photo — not from novelty letterforms. That trade is
  deliberate: a face that looks toy-like at the cost of confusable letters is
  exactly the "generic fun display face" the brief rejects.
- **Rejected alternatives.** *Quicksand* — truly round terminals and single-story
  `a`/`g`, but its geometric circles make `b/d/p/q` mirror-symmetric and its 400
  weight is too thin to hold on a dark ground. *Baloo 2* — toy-like and heavy, but
  double-story `a` and a display face at heart, illegible at body sizes.
  *Lexend* / *Nunito* / *Atkinson Hyperlegible* — all good reading faces, all
  double-story `a`, which fails the single-story requirement outright.

**Legibility on dark: verified.** A specimen of Andika 400/700 in Moonmilk and
Ember on Nightshade was rendered and inspected. It holds: the single-story forms
are unambiguous, `bag / goggle / Illinois / 1lI` all read cleanly, and the 700
weight is warm and open rather than blocky. Andika 400 is on the light side at
small sizes on dark, which is why:

> **Rule:** nothing child-facing renders below `--font-size-child-min` (18px).
> Child body copy is `--font-size-child-body` (20px) at weight 400; child
> emphasis and headings are weight 700. Andika 400 below 18px on dark is
> forbidden.

### 2.2 (historical) Caregiver face — **Inter** (variable weight axis)

`--font-caregiver: 'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, sans-serif`

- A neutral grotesque designed for **UI at small sizes** — which is what a
  caregiver dashboard is. x-height 1118/2048 (0.546 em), taller than Andika's, so
  it stays readable at the 12–14px sizes the caregiver side actually uses.
- **Maximally distinct from Andika**: double-story `a`, binocular `g`, tighter
  spacing, cooler and more mechanical. Put side by side on one screen nobody
  would mistake one for the other, which is what keeps the two audiences' screens
  from bleeding into each other.
- **Variable weight is load-bearing.** Light text on a dark ground optically gains
  weight (irradiation). The variable axis lets us set
  `--weight-caregiver-body: 420` and `--weight-caregiver-strong: 620` — values a
  static-weight package could not express — so caregiver text looks like 400/600
  rather than reading a notch too heavy. Paired with
  `--tracking-caregiver: -0.006em`.

### 2.3 Offline-safe delivery

**No runtime font fetch exists anywhere in this app.** `index.html` has no
`<link>` to `fonts.googleapis.com`; nothing `@import`s a CDN.

- `@fontsource-variable/nunito` is an npm dependency. It ships the actual
  `.woff2` file inside the package (§2.1a supersedes the two-package setup
  this section originally described).
- `src/design/fonts.css` declares the `@font-face` rule by hand, pointing at the
  package file. Vite resolves that at **build** time and emits it into
  `dist/assets/` with a content hash.
- `vite.config.ts`'s workbox `globPatterns` includes `woff2`, so the service
  worker precaches it.
- **Latin subset only, declared by hand.** The package also ships cyrillic,
  cyrillic-ext, latin-ext and vietnamese. Importing the package's own
  `index.css` would push all of that through the precache whether or not a
  glyph is ever drawn. `index.html` is `lang="en"`.
- Glyphs outside the latin subset (e.g. the `▾ ▸` accordion markers) fall through
  to the system stack. Intentional and fine.

The old `App.css` header comment said "no web fonts — a font fetch would quietly
break offline." **That constraint is still in force.** Only the conclusion
changed: it is satisfied by delivery, not by abstinence.

### 2.4 Applying the two roles

`.app` is `--font-caregiver` by default. Two utility classes in `App.css`
still exist and still both resolve to Nunito today (§2.1a):

- `.child-face` — 20px, weight 400, `--tracking-child`, line-height 1.45.
- `.caregiver-face` — `--weight-caregiver-body`, `--tracking-caregiver`.

> **Rule, still in force:** if a child-facing phase ever needs distinct
> type treatment again, put `.child-face` on its wrapper. **Nothing else may
> set `font-family` directly**, ever. If a component needs a font, it needs
> one of these two classes.

---

## 3. Glass, tuned for a dark base

The material is unchanged in concept — `backdrop-filter` blur + saturate,
translucent fill, bright rim, soft outer shadow, `@supports` solid fallback. What
changes on dark is every number, plus two things the light system did not have at
all.

### 3.1 What a naive light-to-dark swap gets wrong

Light mode used `rgba(255,255,255,0.55)` fill and one inset top highlight. Carried
onto a dark ground unchanged, that produces **fog** — a milky rectangle with no
edge and no depth. Three corrections:

1. **Fill alpha drops by ~8×.** `--glass-bg: rgba(255,255,255,0.07)`,
   `--glass-bg-strong: rgba(255,255,255,0.12)`. The panel is a *tint over the
   ground*, not a sheet laid on top of it.
2. **`brightness()` joins the backdrop filter.** On a dark ground, blur + saturate
   lift nothing — there is no luminance to redistribute. The panel has to
   physically brighten what is behind it or it reads as a flat darker rectangle.
   `--glass-brightness: 1.16`, composed into `--glass-filter` alongside
   `--glass-blur: 22px` and `--glass-saturate: 150%`.
3. **The rim becomes two-tone.** A real slab of glass has a lit top edge and a
   shadowed bottom edge; that pair is what communicates *thickness*. Light mode
   only needed the top one.

### 3.2 The tokens

```
--glass-bg:          rgba(255,255,255,0.07)
--glass-bg-strong:   rgba(255,255,255,0.12)
--glass-border:      rgba(255,255,255,0.14)
--glass-blur:        22px
--glass-saturate:    150%
--glass-brightness:  1.16
--glass-filter:      blur(22px) saturate(150%) brightness(1.16)   /* composed */

--glass-rim-top:     inset 0  1px  0            rgba(255,255,255,0.22)
--glass-rim-bottom:  inset 0 -1px  0            rgba(0,0,0,0.34)
--glass-inner-glow:  inset 0 14px 30px -16px    rgba(255,255,255,0.18)
--glass-highlight:   var(--glass-rim-top), var(--glass-rim-bottom), var(--glass-inner-glow)

--glass-shadow:      0 14px 34px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.42)

--glass-tint-child:      rgba(255,176,103,0.05)   /* Ember    */
--glass-tint-caregiver:  rgba(139,123,255,0.045)  /* Periwink */
```

`--glass-highlight` **kept its name** deliberately: every existing consumer
already writes `box-shadow: var(--glass-shadow), var(--glass-highlight)`, so
recomposing it from one inset highlight into a three-part rim upgrades every
surface in the app without touching a single component.

Shadows also had to change kind, not just value: on dark, a shadow cannot be "a
bit of the ink colour" — it must be near-black and much larger and softer, or it
vanishes. Hence `--shadow-md: 0 14px 34px rgba(0,0,0,0.6), 0 3px 8px rgba(0,0,0,0.45)`.

### 3.3 The ambient gradient is emissive, not subtractive

`.app`'s mesh gradient inverted in *kind*. On paper, the washes sat darker than
the ground. On a dark ground they have to read as **light pooling in a dark
room**, so they sit brighter than the base and carry more alpha: Periwink at 0.16
top-left, Ember at 0.10 top-right, Blush at 0.07 bottom. Still completely static —
this audience needs low sensory load, so it never animates.

### 3.4 Two temperatures, one material

Child and caregiver screens use the **same** glass. The only differences are:

| | Child | Caregiver |
| --- | --- | --- |
| Tint | `--glass-tint-child` (Ember) | `--glass-tint-caregiver` (Periwink) |
| Fill | `--glass-bg` — lighter, airier | `--glass-bg-strong` — denser, more Apple-system |
| Radius | `--radius-lg` / `--radius-frame` | `--radius-md` |
| Panels on screen | 1–2 | 3–5 |

This is the whole of the child/caregiver split at the material level. There is no
second skin.

### 3.5 Contrast, measured

WCAG ratios against Nightshade `#16121D` and against glass composited over it
(`--glass-bg` ≡ `#26232D`, `--glass-bg-strong` ≡ `#322E38`):

| Foreground | on `--color-bg` | on `--glass-bg` | on `--glass-bg-strong` |
| --- | --- | --- | --- |
| `--color-ink` `#F4EFE8` | **16.13** | **13.49** | **11.59** |
| `--color-ink-muted` `#A79CB5` | **7.09** | **5.93** | **5.09** |
| `--color-primary` `#8B7BFF` | **5.60** | **4.69** | 4.03 ✗ |
| `--color-primary-bright` `#A99DFF` | 7.87 | — | **5.65** |
| `--color-accent` `#FFB067` | **10.24** | **8.57** | — |
| `--color-reward` `#FFC93C` | **12.01** | **10.05** | — |
| `--color-companion` `#FF7E9D` | **7.66** | **6.41** | — |
| `--color-danger` `#FF8A80` | **8.08** | **6.76** | — |
| `--color-border-strong` (non-text, 3:1) | **3.85** | **3.22** | 2.35 ✗ |
| `--color-primary-ink` on a Periwink fill | **5.5** | — | — |

Everything meets AA (4.5:1 text / 3:1 non-text) except the two cells marked ✗,
which are the reason `--color-primary-bright` exists.

> **Rule:** Periwink as *text* is approved on `--color-bg` and `--glass-bg`. On
> `--glass-bg-strong`, switch to `--color-primary-bright`. `.header-eyebrow`
> currently sits on the app ground and is fine; if it is ever moved onto the
> stronger glass it must switch.

---

## 4. Layout restraint

### 4.1 Child screens — Duolingo-level

- **Exactly one primary action visible.** If a second control is on screen it is
  either the Companion or nothing. No back button, no settings, no level picker —
  `App.tsx`'s `childFacing` flag already suppresses `AppHeader` and `ScreenHeader`
  during child phases; do not reintroduce chrome under it.
- **Nothing that reads as a score, timer or progress bar.** (Existing
  UI-STANDARDS rule; restated because dark mode makes glowing progress bars
  tempting.)
- One subject at a time: the Room Frame, or the crop grid, never both.
- Vertical rhythm `--space-child-gap` (28px). Generous whitespace is load-bearing,
  not decoration.
- Touch targets: child-facing screens keep their 88px floor as hardcoded pixel
  values in each game file (`src/games/*`) — confirmed via grep, none of them
  reference `--touch-min` — so they are untouched by the change below. On
  phones the crop row scrolls horizontally rather than shrinking. The single
  primary action uses `--child-action-min` (120px).
  **`--touch-min` itself is 44px, not 88px** — lowered as a deliberate,
  later product decision (see its comment in `App.css`'s `:root`) for the
  CAREGIVER-facing chrome that actually consumes this token (Setup, Notes,
  Dashboard, the tab bar, the back button, Welcome). `plan/engineering/
  UI-STANDARDS.md`'s own "88x88pt minimum touch target, no exceptions" text
  is left as-written and this is a knowing, on-the-record departure from it,
  not an oversight.
- Zero text in the child's view.

### 4.2 Caregiver screens — denser, but carded

- **Three to five clear cards**, never one dense dashboard. The existing accordion
  pattern in `CaregiverDashboard.tsx` is the right shape.
- Vertical rhythm `--space-caregiver-gap` (14px).
- `--glass-bg-strong` + `--radius-md`: closer to Apple's own system chrome.
- Information first: numbers and labels in Inter, tight tracking, muted secondary
  text. No Ember/Sunburst/Blush decoration — the reserved hues do not appear on
  caregiver screens at all.
- Non-diagnostic banner stays on every render path (existing rule).

### 4.3 The leak rule

Child styling must not leak into caregiver screens and caregiver density must not
leak into child screens. Concretely: **`.child-face`, `--space-child-gap`,
`--child-action-min`, `--glass-tint-child`, `--color-reward` and
`--color-companion` are forbidden on caregiver screens**, and
`--space-caregiver-gap`, `--glass-bg-strong` and any text at all are forbidden in
a child phase.

---

## 5. Signature element — the Room Frame

**The idea.** A real photograph of the child's own object, matted in a slab of
glass, floating on the dark ground, with the photo's **own colour blooming out
behind it to light the room**. Concrete, textured, personal photo against soft
abstract glass. The bloom is the part specific to this product: the whole app is
built on photos of the child's room, so the child's room is literally what lights
the interface.

**Markup** (implemented as `.room-frame*` in `App.css`; Phase 2 renders this):

```html
<div class="room-frame">
  <img class="room-frame-bloom" src={photo} alt="" aria-hidden="true" />
  <div class="room-frame-mat">
    <img class="room-frame-photo" src={photo} alt="" />
  </div>
</div>
```

**Exact spec:**

| Part | Value |
| --- | --- |
| Outer size | `width: min(72vw, 320px)`, `aspect-ratio: 1/1` (`.room-frame--portrait` → `4/5` for the Companion) |
| Mat (the glass) | `padding: var(--frame-mat)` = **14px** on all four sides |
| Outer radius | `--radius-frame` = **34px** |
| Inner radius | `--radius-frame-inner` = **20px** (= 34 − 14, so the corners are concentric — this is why it looks like a frame and not a box with a picture in it) |
| Mat fill | `--glass-bg-strong` (`rgba(255,255,255,0.12)`) |
| Mat backdrop filter | `blur(26px) saturate(160%) brightness(1.16)` — 26px, deliberately blurrier than the 22px system default, because the frame is the one place the material should be *felt* |
| Mat rim | `1px solid var(--glass-border)` + `--glass-highlight` (two-tone rim + inner glow) |
| Mat shadow | `0 22px 50px rgba(0,0,0,0.6), 0 4px 10px rgba(0,0,0,0.45)` |
| Photo | `object-fit: cover`, radius 20px |
| Photo depth | `0 8px 20px rgba(0,0,0,0.55)` **plus** `inset 0 0 0 1px rgba(0,0,0,0.4)`. The inset hairline is what makes the photo sit *in* the mat; without it the photo reads as a sticker on top of the glass. |
| Bloom | the same `<img>`, `position:absolute; inset:0; z-index:-1`, `object-fit: cover`, `transform: scale(1.14)`, `filter: blur(38px) saturate(1.5)`, `opacity: 0.5`, `pointer-events:none` |

**States:**

- `.room-frame--reward` — rim becomes `--color-reward`; shadow becomes
  `0 0 0 3px rgba(255,201,60,0.16), 0 0 48px var(--color-reward-glow),
  0 22px 50px rgba(0,0,0,0.6), var(--glass-highlight)`.
- `.room-frame--companion` — rim becomes `--color-companion`; shadow becomes
  `0 0 0 3px rgba(255,126,157,0.14), 0 0 44px var(--color-companion-glow),
  0 22px 50px rgba(0,0,0,0.6), var(--glass-highlight)`.
- When Game1's `--g1-accent` (the child's own favourite colour) is present on the
  element, it **overrides** Blush for the Companion rim. The child's own colour
  outranks a system default.

**Fallback:** where `backdrop-filter` is unsupported, `.room-frame-mat` falls back
to solid `--color-surface`. The bloom still works — it is a plain blurred `<img>`.

---

## 6. Files this system lives in

| File | Role |
| --- | --- |
| `src/design/DESIGN-TOKENS.md` | **This document. Source of truth.** |
| `src/App.css` `:root` | The dark token implementation (default/unset `[data-theme]`). |
| `src/App.css` `:root[data-theme='light']` | The light token implementation — same token names, §9's values. |
| `src/App.css` (rules) | Base `button`, `.app`, `.app-header`, `.child-face`/`.caregiver-face`, `.room-frame*`, print overrides, plus the light-mode ambient-gradient override. |
| `src/design/fonts.css` | The two `@font-face` sets. Latin subsets only. No CDN. |
| `src/index.css` | `color-scheme: dark` by default, `light` under `:root[data-theme='light']`. |
| `src/engine/themePreference.ts` | Reads/writes the caregiver's light/dark choice via the shared `StoragePort`. |
| `src/App.tsx` | Owns the `theme` state, mirrors it onto `<html data-theme>`, renders the Appearance toggle in the Setup tab. |
| `vite.config.ts` | `woff2` in workbox `globPatterns`; PWA `theme_color`/`background_color` stay set to the dark ground (the app's default identity) regardless of the caregiver's in-app choice. |

Token **names** were all preserved, so every existing consumer — `Game1.tsx`,
`Game2.tsx`, `Game3ShadowMatch.tsx`, and everything under `src/screens/` — picked
up the new system with no edits at all.

---

## 7. Phase 2 handoff — known light-mode literals still in components

Phase 1 did not touch `src/games/` or `src/screens/`. These hardcoded colours will
read wrong on the dark ground and are Phase 2's to migrate. Targets in §1.4.

| File | Lines | Literal → token |
| --- | --- | --- |
| `src/screens/CaregiverDashboard.tsx` | 34 | `#ccc` border → `--color-border` |
| `src/screens/ResponseProfile.tsx` | 152 | `#333` / `'white'` toggle → `--color-primary` / `--color-surface` |
| `src/screens/CompanionCapture.tsx` | 121 | same toggle pattern |
| `src/screens/AvoidList.tsx` | 64, 102 | same toggle pattern |
| `src/screens/QuickPreferences.tsx` | 84 | same toggle pattern |
| `src/games/Game1.tsx` | 207–208, 362–363, 390, 454, 1212 | `#ffffff` / `#fff` crop backing → `--color-tile` / `--color-tile-border` |
| `src/games/Game1.tsx` | 916, 927, 944, 1077 | `#a33` → `--color-danger`; `#eef` → `--color-info-soft`; `#ccc` → `--color-border` |
| `src/games/Game3ShadowMatch.tsx` | 83, 146, 427, 435, 442, 511, 532, 557, 600 | `#eef`/`#ccc`/`#ddd`/`#557`/`#a33` → `--color-info-soft` / `--color-border` / `--color-surface` / `--color-primary` / `--color-danger` |
| `src/games/Game1.tsx`, `Game2.tsx` | 99, 73 | `'#ccc'` unknown-colour fallback → `--color-border-strong` |

Also for Phase 2:

- `.child-face` needs to go on the wrappers of each game's child-facing phases.
- Game2's `<style>` block writes `backdrop-filter: none` in two places — confirm
  that is still wanted now that the glass is dark-tuned.
- Screens that hardcode `backdrop-filter: blur(...) saturate(...)` should move to
  `var(--glass-filter)` so they pick up `brightness()`.

---

## 8. Verification performed in Phase 1

- Every contrast figure in §3.5 computed with the WCAG relative-luminance formula,
  including glass fills composited over Nightshade — not eyeballed.
- Andika's `a.SngStory` / `g.SngBowl` defaults and both faces' x-height/cap-height
  metrics read directly out of the shipped `.woff2` files with fontTools.
- A dark-ground type specimen of both faces rendered and visually inspected for
  letterform disambiguation and halation.
- `npx tsc -b --force`, `npx oxlint`, `npm run build` — all clean.
- `dist/sw.js` inspected: all three `.woff2` files are in the precache manifest,
  so the app still works fully offline on a cold launch.

---

## 9. Light theme (Phase 3)

Not dark inverted. Same token names, same structural relationships (ground is
still six values with the same raised/sunken direction; interactive still has
a base + a "more contrast on strong glass" step; glass is still fill + border
+ two-tone rim + inner glow + shadow), different values chosen against a
paper ground instead of computed from the black one.

### 9.1 Ground

Same hue family as dark — ~265 violet-plum, very low saturation — approached
from the light side. `--color-ink` is dark's own `--color-surface` hex
(`#241e2e`, Slate Plum) reused verbatim as light's text colour: the two
themes share one small vocabulary of plum tones and just swap which end of it
each token sits at. Not pure black on purpose, for the same halation reason
dark avoided pure white on Nightshade.

| Token | Name | Hex | vs dark |
| --- | --- | --- | --- |
| `--color-surface-sunken` | Putty | `#EAE2D6` | page behind the device, a step *deeper* than the ground, same relationship dark's Pitch has to Nightshade |
| `--color-bg` | Parchment | `#F6F1E9` | the app's own ground |
| `--color-surface` | — | `#FFFDF9` | raised surface, a step *lighter*, same relationship dark's Slate Plum has to Nightshade |
| `--color-ink` | Ink Plum | `#241E2E` | = dark's `--color-surface`. 14.37:1 on Parchment |
| `--color-ink-muted` | — | `#5E5169` | 6.54:1 on Parchment |
| `--color-border` | — | `#E4DAE6` | decorative hairline |
| `--color-border-strong` | — | `#8B7C99` | functional edge, 3.43:1 on Parchment, 3.73:1 on the glass composite |

### 9.2 Interactive and reserved

Periwink is restored close to the `#5b52e8` DESIGN-TOKENS §1.2 already
documents as light mode's *original* value — dark re-pitched it lighter
because a dark ground needs the hue to come toward the light; a light ground
never stopped needing it to sit *under* the paper, so light mode returns
there instead of inheriting dark's re-pitch.

| Token | Hex / value | vs dark |
| --- | --- | --- |
| `--color-primary` | `#5B52E8` | 4.89:1 on Parchment. Button polarity goes back to NORMAL here — a saturated fill with light ink — because plain Periwink already clears AA on paper; dark's flip existed only to fix a failure light mode never has. |
| `--color-primary-bright` | `#4A3FD4` | small text on `--glass-bg-strong`; 6.66:1 there. Kept as a distinct token for the same visual-hierarchy role dark's version fills, even though light's plain primary does not fail on strong glass the way dark's does. |
| `--color-primary-ink` | `#FAF7FF` | warm near-white ink on a Periwink fill, 5.50:1 |
| `--color-accent` (Ember) | `#A6540F` | 4.79:1 on Parchment. Same "sits under the paper" re-pitch as primary. |
| `--color-accent-ink` | `#FFFBF6` | 4.79:1+ on the new Ember fill |
| `--color-reward` (Sunburst) | `#B87805` | **Reserved, unchanged role.** Dark's raw `#ffc93c` measures under 2:1 on Parchment — a straight carry-over would read as washed pastel, not "reward". Re-pitched darker/richer so it stays legible as a rim/glow/confetti colour and still reads as the same golden family. `--color-reward-ink` (`#2a1d02`, unchanged) still measures 4.49:1 on it. |
| `--color-companion` (Blush) | `#C43F68` | **Reserved, unchanged role.** Same re-pitch reasoning as Sunburst — deep rose instead of dark's bright pink, 4.39:1 non-text contrast on Parchment. |

Both reserved hues keep their exclusivity rule from §1.3 unchanged: reward
beats and the Companion only, never chrome, in either theme.

### 9.3 Glass, tuned for a light base

The inverse of DESIGN-TOKENS §3.1's dark tuning, not its negation:

1. **Fill alpha goes back up, not further down.** `--glass-bg:
   rgba(255,255,255,0.55)`, `--glass-bg-strong: rgba(255,255,255,0.72)` — the
   denser white-frost alpha §3.1 already describes as the *original*
   pre-dark value, restored rather than reinvented, because a light ground
   needs a visibly frosted pane, not a thin tint.
2. **`brightness()` drops out of the filter.** `--glass-brightness: 1.` Dark
   needed to physically lift the ground because blur+saturate alone lift
   nothing off black. A light ground already has all the luminance a
   frosted pane needs; brightness() here would blow the panel out toward
   flat white instead of reading as glass.
3. **The rim keeps its two-tone shape but softens.** The top edge stays a
   genuine bright catch-light (`rgba(255,255,255,0.9)`); the bottom
   edge and inner glow shrink from dark's near-black/bright-white pair to a
   near-imperceptible ink shadow (`rgba(36,30,46,0.08)`) and a soft white
   sheen — present, not zeroed, so `--glass-highlight` still reads as one
   three-part material on both themes.
4. **`--glass-border` flips from white to ink.** A `rgba(255,255,255,x)`
   line is the only thing visible against Nightshade; it is invisible
   against Parchment. Light's border is `rgba(36,30,46,0.12)` — the same
   move applied to every other white-only rim/wash token in `App.css`
   (`--surface-wash`, `--surface-wash-active`, `--hatch-line`, and
   `--color-tile-border`, §9.4).
5. **Shadows shrink and warm.** §3.2 states a dark shadow "cannot be a bit
   of the ink colour — it must be near-black and much larger." On light it
   can be exactly that: `--glass-shadow` and `--shadow-md` both become
   smaller, softer, and tinted with `--color-ink` (`rgba(36,30,46,x)`)
   instead of flat black.

### 9.4 The child-facing "light stage on light shell" question

Game3ShadowMatch's silhouette tiles and TraceAndColour's drawing surface both
already consume `--color-tile` / `--color-tile-border` / `--glass-border`
rather than hardcoded literals (confirmed by reading both files), so no game
file needed editing — retuning these tokens here is sufficient.

**Deliberate call: `--color-tile` stays light in both themes.** This is not
a stylistic preference carried over from §1.4 — it is a hard technical
requirement. Game3's silhouettes render with `filter: brightness(0)` (solid
black) and `silhouetteCanvas.ts` produces black-on-transparent PNGs; a dark
tile would make both invisible regardless of theme. `--color-tile` is
`#FFFFFF` in light mode (brighter than dark's `#F0EAF5`, which only needed
to beat a near-black ground and did not need to hold its own against a light
one).

**What DOES change: `--color-tile-border`.** Dark's bright
`rgba(255,255,255,0.86)` rim is what separates a light tile from the
near-black shell around it. Carried unchanged into light mode, that same
white rim disappears against a light shell — exactly the "light stage
directly on a light ground with no edge at all" failure mode this phase's
brief called out by name. Light's tile border is redefined as a soft
ink-tinted line, `rgba(36,30,46,0.16)`, giving every tile a visible edge
against its now-light surroundings without touching the tile's own colour
(which, per the requirement above, cannot move). Both games pick this up
automatically through the token, and the outer `--glass-border`/
`--glass-shadow` around each tile (also retuned in §9.3) carry the rest of
the definition that used to come for free from sheer luminance contrast
against Nightshade.

**Recommend a human eyeball this on a real device.** The contrast math says
this holds, but "does the tile still read as a distinct lit object, not just
a slightly-outlined patch of the same colour as the page" is a judgement
call worth a second set of eyes on Game3's option grid and TraceAndColour's
drawing surface specifically, in light mode, on an actual phone screen.

### 9.5 Utility surfaces and track colours

Same re-pitch principle as §9.2 — darker/more saturated so text and
non-text contrast both clear their bars against Parchment instead of
Nightshade:

| Token | Light value | vs dark |
| --- | --- | --- |
| `--color-danger` | `#B23A2C` | 5.28:1 on Parchment |
| `--color-danger-soft` | `#FBEAE7` | pale coral wash, was a dark tinted panel |
| `--color-info-soft` | `#ECEBF9` | pale periwink wash, was a dark tinted panel |
| `--track-find-it/-story/-match/-trace` | `#5B52E8` / `#0E7A6F` / `#8A4FD6` / `#3E6FC9` | each ≥4.35:1 on the near-white dashboard card composite |

### 9.6 Wiring and persistence

`data-theme="light"` / unset (dark) on `<html>`, set in `App.tsx` from a
`theme` state variable, never a JS-computed inline style — the same
CSS-custom-property flow every other token already uses. Persisted through
`src/engine/themePreference.ts`, which reads/writes a single
`'themePreference'` key via the same `StoragePort` `profileStore.ts` uses for
every other caregiver preference (a device-level key, parallel to
`ACTIVE_PROFILE_KEY`, not scoped to a child profile). No
`prefers-color-scheme` branch: the OS setting is never read.

Toggle location: the Setup tab's "This device" area in `App.tsx`, next to Log
out — both are device-level settings, not profile-level ones, and Setup was
already the caregiver's settings home. Rendered as a two-option segmented
row (`.home-theme-row`/`.home-theme-option` in `App.css`), the same
construction as the dashboard's session-length picker but at the standard
`--touch-min` (44px) floor rather than that picker's deliberate 88px
exception — this is ordinary settings chrome, not a control tapped while
holding a child.

### 9.7 Verification performed in Phase 3

- Every contrast figure in §9.1/§9.2/§9.5 computed with the same WCAG
  relative-luminance formula §3.5 uses, including glass fills composited
  over Parchment — not eyeballed.
- Confirmed via grep that `--touch-min` semantics are unchanged by this
  phase (still 44px, still applied only where it already was) and that
  every existing `--color-reward`/`--color-companion` reference (the reward/
  Companion states in `SessionCelebration.tsx`, `BlockStackMatch.tsx`,
  `Game3ShadowMatch.tsx`, `SortByRule.tsx`, `TraceAndColour.tsx`, and the
  `.room-frame--reward`/`--companion` rules in `App.css`) is a genuine
  reward/Companion moment, never general chrome — nothing in this phase
  added a new reference to either token.
- `npx tsc -b`, `npx oxlint`, `npm run smoke`, `npm run build` — all clean.
