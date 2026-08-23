// The concept library — the drawings. Data and rules live in
// conceptLibrary.ts; this file is only pictures, so the rules stay
// testable in Node (JSX is not).
//
// DRAWN DIFFERENTLY FROM games/objectIcons.tsx, ON PURPOSE
// -------------------------------------------------------
// Those icons are 64x64 and 3-7 shapes, because they have to survive at
// 34px on a room map. These are 240x240 and much richer, because the child
// is asked to STUDY them and decide whether two pictures are the same kind
// of thing. Detail that would be mud at 34px is the whole point at 160px.
//
// Three rules every drawing here follows:
//
//  1. SIZE IS DRAWN, NOT STYLED. A "small" apple is small INSIDE its own
//     240x240 box. If every variant filled the frame, the tiles would all
//     be the same size on screen and the child would never see size as a
//     way apples differ — which is one of the things this set exists to
//     teach. Callers must therefore render every variant at the SAME
//     display size and let the artwork carry the difference.
//
//  2. NO VARIANT IS A TRANSFORM OF ANOTHER. Each drawing has its own paths.
//     A mirrored or recoloured copy would look like variation while
//     teaching nothing: it is still one apple wearing a hat.
//
//  3. NOTHING THAT DOES NOT EXIST. An early draft split the two-tone apple
//     straight down the middle, half red and half yellow. No apple looks
//     like that, and a set built to teach what a real apple can look like
//     cannot contain a fictional one — it teaches the wrong boundary. Real
//     two-tone apples carry a soft blush with streaks, which is what
//     'apple-blushed' draws now.
//
// No gradients or clipPaths anywhere in this file: they need document-unique
// ids, and a trial renders several variants at once, so two instances would
// collide and silently corrupt each other's fills. Soft edges are built by
// layering low-opacity paths instead.

import type { ReactElement } from 'react';
import type { VariantId } from './conceptLibrary';

/** Richer than the Game 1 palette because these drawings need shading and
 * a second tone per object, but deliberately in the same family so the two
 * libraries read as one app. */
const C = {
  deepRed: '#B8232B', deepRedShade: '#8E161D',
  lightRed: '#E4626A', lightRedShade: '#C2454D',
  green: '#7FB542', greenShade: '#5E8F2E',
  golden: '#D9C44A', goldenShade: '#B3A032',
  tomato: '#D93B2B', tomatoShade: '#A82A1E',
  berry: '#D8324A', berryShade: '#A62034', berryPale: '#EE7C93',
  orange: '#EE8B2B', orangeShade: '#C46A16', orangePale: '#F2B457',
  banana: '#EFCB46', bananaShade: '#C9A62E',
  ballRed: '#D8382F', ballBlue: '#4A79D8', ballGreen: '#4FA85C', ballYellow: '#EFC13F',
  brown: '#9A6A42', brownDark: '#6E4A2C',
  cream: '#F2E3CC', creamShade: '#D6C3A6',
  grey: '#A8AAB4', greyShade: '#82848E',
  ink: '#2E2C38', white: '#FAF7F1',
  blue: '#4A8FD8', blueShade: '#3568A6',
  leaf: '#4E9E45', leafDark: '#3B7A34',
  stem: '#7A4A2B',
  shadow: '#211F2E',
  tyre: '#3A3A46',
  glass: '#BFD9E8',
} as const;

/** A soft contact shadow. Every object gets one so they read as things
 * sitting in a space rather than stickers — which also makes the size
 * differences legible. */
function Ground({ cy, rx }: { cy: number; rx: number }) {
  return <ellipse cx="120" cy={cy} rx={rx} ry={rx * 0.16} fill={C.shadow} opacity="0.1" />;
}

/** The specular highlight. Always upper-left, in every drawing, so the
 * light source is consistent across the whole set — inconsistent lighting
 * reads as "different scene" and adds noise to the comparison the child is
 * being asked to make. */
function Gloss({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#ffffff" opacity="0.3" transform={`rotate(-24 ${cx} ${cy})`} />;
}

/** Two dots and a muzzle, shared by every animal and the teddy. Species is
 * carried by body and ear shape, never by the face — so a child cannot
 * shortcut "is it a dog" by reading the eyes. */
function Face({ cx, cy, s = 1, dark = C.ink }: { cx: number; cy: number; s?: number; dark?: string }) {
  return (
    <>
      <circle cx={cx - 13 * s} cy={cy} r={4.5 * s} fill={dark} />
      <circle cx={cx + 13 * s} cy={cy} r={4.5 * s} fill={dark} />
      <ellipse cx={cx} cy={cy + 13 * s} rx={7 * s} ry={5 * s} fill={dark} />
    </>
  );
}

const ART: Record<VariantId, ReactElement> = {
  // === APPLES =============================================================
  'apple-deep-red': (
    <>
      <Ground cy={210} rx={62} />
      <path d="M120,62 C104,36 62,36 48,70 C32,108 44,174 84,200 C100,211 112,203 120,203 C128,203 140,211 156,200 C196,174 208,108 192,70 C178,36 136,36 120,62 Z" fill={C.deepRed} />
      <path d="M120,203 C128,203 140,211 156,200 C196,174 208,108 192,70 C186,56 172,48 158,46 C176,74 180,140 150,182 C140,196 130,202 120,203 Z" fill={C.deepRedShade} opacity="0.55" />
      <path d="M118,64 C115,44 119,30 128,21" stroke={C.stem} strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M128,38 C150,18 182,24 186,40 C174,60 142,60 128,38 Z" fill={C.leaf} />
      <Gloss cx={82} cy={98} rx={17} ry={30} />
    </>
  ),
  'apple-light-red': (
    <>
      <Ground cy={208} rx={48} />
      <path d="M120,54 C110,30 78,28 68,62 C56,102 64,176 92,200 C104,210 114,202 120,202 C126,202 136,210 148,200 C176,176 184,102 172,62 C162,28 130,30 120,54 Z" fill={C.lightRed} />
      <path d="M120,202 C126,202 136,210 148,200 C176,176 184,102 172,62 C168,52 160,46 152,44 C166,80 166,150 144,184 C136,196 128,201 120,202 Z" fill={C.lightRedShade} opacity="0.5" />
      <path d="M119,56 C117,38 121,26 129,18" stroke={C.stem} strokeWidth="9" fill="none" strokeLinecap="round" />
      <Gloss cx={92} cy={92} rx={14} ry={28} />
    </>
  ),
  'apple-green': (
    <>
      <Ground cy={196} rx={40} />
      <path d="M120,104 C110,86 84,86 76,110 C66,138 74,174 98,190 C110,198 116,192 120,192 C124,192 130,198 142,190 C166,174 174,138 164,110 C156,86 130,86 120,104 Z" fill={C.green} />
      <path d="M120,192 C124,192 130,198 142,190 C166,174 174,138 164,110 C160,100 152,94 145,92 C157,120 156,164 138,182 C132,188 126,191 120,192 Z" fill={C.greenShade} opacity="0.5" />
      <path d="M119,106 C117,92 120,82 127,76" stroke={C.stem} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M127,90 C143,76 165,80 168,92 C159,106 137,106 127,90 Z" fill={C.leaf} />
      <Gloss cx={96} cy={128} rx={11} ry={20} />
    </>
  ),
  'apple-golden': (
    <>
      <Ground cy={206} rx={70} />
      <path d="M120,76 C100,52 50,54 38,90 C24,130 48,180 88,196 C102,202 112,196 120,196 C128,196 138,202 152,196 C192,180 216,130 202,90 C190,54 140,52 120,76 Z" fill={C.golden} />
      <path d="M120,196 C128,196 138,202 152,196 C192,180 216,130 202,90 C196,76 184,68 170,64 C190,96 188,158 152,184 C142,192 130,195 120,196 Z" fill={C.goldenShade} opacity="0.5" />
      <path d="M119,78 C117,60 120,48 128,40" stroke={C.stem} strokeWidth="9" fill="none" strokeLinecap="round" />
      <Gloss cx={74} cy={110} rx={18} ry={26} />
    </>
  ),
  // === ORANGES ============================================================
  // Citrus is carried by PITTED SKIN and a navel mark, not by the colour
  // orange — without those a plain orange circle is just a ball, which is
  // exactly the confusion the ball concept is here to exploit.
  'orange-navel': (
    <>
      <Ground cy={214} rx={70} />
      <circle cx="120" cy="132" r="76" fill={C.orange} />
      <path d="M120,208 A76,76 0 0,0 190,86 A150,150 0 0,1 120,208 Z" fill={C.orangeShade} opacity="0.4" />
      {[[92, 100], [136, 96], [158, 132], [104, 146], [146, 168], [80, 148], [122, 122]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill={C.orangeShade} opacity="0.55" />
      ))}
      <circle cx="120" cy="200" r="11" fill={C.orangeShade} opacity="0.55" />
      <circle cx="120" cy="200" r="5" fill={C.orangeShade} opacity="0.85" />
      <path d="M120,58 C118,46 122,40 128,36" stroke={C.stem} strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M126,48 C146,32 174,38 176,52 C164,68 138,66 126,48 Z" fill={C.leaf} />
      <Gloss cx={86} cy={98} rx={18} ry={26} />
    </>
  ),
  'orange-mandarin': (
    <>
      <Ground cy={196} rx={48} />
      <ellipse cx="120" cy="154" rx="52" ry="42" fill={C.orangeShade} />
      <path d="M120,196 A52,42 0 0,0 170,124 A100,86 0 0,1 120,196 Z" fill={C.brownDark} opacity="0.25" />
      {[[98, 134], [142, 140], [116, 166], [80, 156]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill={C.brownDark} opacity="0.35" />
      ))}
      <circle cx="120" cy="190" r="8" fill={C.brownDark} opacity="0.3" />
      <path d="M120,112 C118,102 121,96 126,92" stroke={C.stem} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M124,100 C140,88 160,92 162,102 C152,114 132,112 124,100 Z" fill={C.leaf} />
      <Gloss cx={98} cy={130} rx={13} ry={17} />
    </>
  ),
  'orange-clementine': (
    <>
      <Ground cy={204} rx={56} />
      <circle cx="120" cy="146" r="60" fill={C.orangePale} />
      <path d="M120,206 A60,60 0 0,0 176,110 A116,116 0 0,1 120,206 Z" fill={C.orangeShade} opacity="0.3" />
      {[[98, 118], [140, 126], [110, 158], [148, 164], [84, 152]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill={C.orangeShade} opacity="0.45" />
      ))}
      <circle cx="120" cy="200" r="9" fill={C.orangeShade} opacity="0.45" />
      <path d="M120,88 C118,78 121,72 127,68" stroke={C.stem} strokeWidth="7" fill="none" strokeLinecap="round" />
      <Gloss cx={92} cy={116} rx={15} ry={20} />
    </>
  ),

  // === TOMATOES ===========================================================
  // Very close to a red apple — same hue, similar size, also a round fruit.
  // The tells are structural: squatter, and a green STAR calyx lying flat
  // instead of a stem-and-leaf.
  'tomato-red': (
    <>
      <Ground cy={212} rx={68} />
      <path d="M120,72 C68,72 34,106 34,144 C34,184 72,208 120,208 C168,208 206,184 206,144 C206,106 172,72 120,72 Z" fill={C.tomato} />
      <path d="M120,208 C168,208 206,184 206,144 C206,120 192,100 170,86 C186,104 194,124 194,144 C194,180 162,200 120,208 Z" fill={C.tomatoShade} opacity="0.5" />
      <path d="M120,60 L136,86 L164,80 L150,102 L172,116 L146,120 L150,142 L120,126 L90,142 L94,120 L68,116 L90,102 L76,80 L104,86 Z" fill={C.leaf} />
      <circle cx="120" cy="106" r="9" fill={C.leafDark} />
      <path d="M120,60 C118,46 120,38 126,32" stroke={C.leafDark} strokeWidth="8" fill="none" strokeLinecap="round" />
      <Gloss cx={78} cy={116} rx={20} ry={26} />
    </>
  ),
  'tomato-small': (
    <>
      <Ground cy={190} rx={40} />
      <circle cx="120" cy="152" r="44" fill={C.deepRed} />
      <path d="M120,196 A44,44 0 0,0 160,126 A88,88 0 0,1 120,196 Z" fill={C.tomatoShade} opacity="0.45" />
      <path d="M120,112 L129,127 L145,123 L137,136 L149,144 L133,146 L135,159 L120,150 L105,159 L107,146 L91,144 L103,136 L95,123 L111,127 Z" fill={C.leaf} />
      <circle cx="120" cy="138" r="5" fill={C.leafDark} />
      <Gloss cx={104} cy={132} rx={11} ry={15} />
    </>
  ),

  // === STRAWBERRIES =======================================================
  // Two things make a strawberry read as one, and the first draft had
  // neither properly: the TAPERED CONE (wide shoulders narrowing to a
  // rounded point) and SEEDS SCATTERED VISIBLY ACROSS THE FACE. Round-and-
  // red with a few faint dots is just a small tomato.
  'strawberry-large': (
    <>
      <Ground cy={214} rx={46} />
      <path d="M120,210 C96,192 66,158 66,126 C66,100 90,84 120,84 C150,84 174,100 174,126 C174,158 144,192 120,210 Z" fill={C.berry} />
      <path d="M120,210 C144,192 174,158 174,126 C174,108 163,95 146,89 C156,104 158,140 141,172 C133,188 126,201 120,210 Z" fill={C.berryShade} opacity="0.45" />
      {[[98, 110], [142, 110], [120, 128], [86, 136], [154, 136], [104, 152], [136, 152], [120, 174], [100, 190], [140, 190]].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4.5" ry="6.5" fill={C.golden} />
      ))}
      <path d="M120,88 L152,62 L154,84 L182,76 L166,96 L120,98 L74,96 L58,76 L86,84 L88,62 Z" fill={C.leaf} />
      <path d="M120,70 C118,54 121,44 128,38" stroke={C.leafDark} strokeWidth="9" fill="none" strokeLinecap="round" />
      <Gloss cx={92} cy={116} rx={13} ry={19} />
    </>
  ),
  'strawberry-small': (
    <>
      <Ground cy={196} rx={30} />
      <path d="M120,194 C104,182 84,158 84,138 C84,120 100,110 120,110 C140,110 156,120 156,138 C156,158 136,182 120,194 Z" fill={C.berryShade} />
      {[[106, 128], [134, 128], [120, 144], [96, 152], [144, 152], [120, 168]].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="3.5" ry="5" fill={C.golden} />
      ))}
      <path d="M120,112 L142,94 L144,110 L164,104 L153,118 L120,120 L87,118 L76,104 L96,110 L98,94 Z" fill={C.leaf} />
      <path d="M120,100 C118,88 121,82 127,78" stroke={C.leafDark} strokeWidth="7" fill="none" strokeLinecap="round" />
      <Gloss cx={102} cy={132} rx={9} ry={13} />
    </>
  ),
  // A rounder, paler berry -- so the concept is not pinned to one outline.
  'strawberry-round': (
    <>
      <Ground cy={206} rx={44} />
      <path d="M120,200 C98,188 74,164 74,138 C74,114 96,100 120,100 C144,100 166,114 166,138 C166,164 142,188 120,200 Z" fill={C.berryPale} />
      <path d="M120,200 C142,188 166,164 166,138 C166,122 156,110 141,104 C149,120 148,152 134,174 C128,185 123,195 120,200 Z" fill={C.berryShade} opacity="0.3" />
      {[[100, 124], [140, 124], [120, 142], [88, 148], [152, 148], [106, 166], [134, 166], [120, 184]].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4" ry="5.5" fill={C.golden} />
      ))}
      <path d="M120,104 L148,82 L150,100 L174,92 L160,110 L120,112 L80,110 L66,92 L90,100 L92,82 Z" fill={C.leaf} />
      <path d="M120,88 C118,74 121,66 127,60" stroke={C.leafDark} strokeWidth="8" fill="none" strokeLinecap="round" />
      <Gloss cx={96} cy={130} rx={12} ry={17} />
    </>
  ),

  // === BANANAS ============================================================
  'banana-ripe': (
    <>
      <Ground cy={206} rx={72} />
      <path d="M44,74 C40,132 76,190 152,196 C182,198 200,186 198,174 C196,162 178,160 158,158 C104,152 74,116 70,72 C68,58 58,52 50,56 C44,59 44,66 44,74 Z" fill={C.banana} />
      <path d="M60,96 C74,140 106,168 158,176 C176,179 192,180 197,178 C196,166 178,161 158,158 C110,152 78,124 64,86 Z" fill={C.bananaShade} opacity="0.55" />
      <path d="M44,74 C42,64 48,54 56,54" stroke={C.brownDark} strokeWidth="11" fill="none" strokeLinecap="round" />
      <ellipse cx="188" cy="180" rx="10" ry="8" fill={C.brownDark} />
    </>
  ),
  'banana-green': (
    <>
      <Ground cy={200} rx={58} />
      <path d="M64,84 C58,130 84,178 146,186 C170,189 184,180 182,170 C180,160 166,159 150,157 C108,152 86,124 84,84 C83,72 74,66 68,70 C63,73 64,78 64,84 Z" fill={C.green} />
      <path d="M76,102 C88,138 112,160 150,166 C164,168 178,170 181,168 C180,160 166,158 150,157 C114,152 92,130 80,96 Z" fill={C.greenShade} opacity="0.5" />
      <path d="M64,84 C62,74 68,66 75,66" stroke={C.leafDark} strokeWidth="10" fill="none" strokeLinecap="round" />
    </>
  ),
  'banana-spotty': (
    <>
      <Ground cy={190} rx={48} />
      <path d="M80,102 C76,138 96,174 144,180 C162,182 172,175 171,167 C170,159 159,158 146,157 C114,153 98,132 96,102 C95,92 88,88 84,91 C80,94 80,98 80,102 Z" fill={C.banana} />
      <path d="M90,116 C99,142 118,158 146,163 C157,165 168,166 170,165 C169,159 159,158 146,157 C118,153 102,138 93,112 Z" fill={C.bananaShade} opacity="0.5" />
      {[[104, 122], [118, 142], [136, 156], [96, 108]].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="6" ry="4.5" fill={C.brownDark} opacity="0.6" transform={`rotate(-30 ${x} ${y})`} />
      ))}
      <path d="M80,102 C78,94 83,88 89,88" stroke={C.brownDark} strokeWidth="9" fill="none" strokeLinecap="round" />
    </>
  ),

  // === CARROTS ============================================================
  // Exists as banana's honest near miss — see BANANA's note in
  // conceptLibrary.ts for the fake-hard-trial the smoke suite caught.
  'carrot-large': (
    <>
      <Ground cy={210} rx={36} />
      <path d="M96,78 L144,78 L128,192 C126,204 114,204 112,192 Z" fill={C.orange} />
      <path d="M144,78 L128,192 C127,198 124,201 121,202 C127,168 133,122 135,78 Z" fill={C.orangeShade} opacity="0.5" />
      <path d="M104,106 h32 M107,134 h27 M111,162 h20" stroke={C.orangeShade} strokeWidth="4" opacity="0.5" strokeLinecap="round" />
      <path d="M120,78 C110,54 90,42 76,46 C88,60 100,68 108,78 Z" fill={C.leaf} />
      <path d="M120,78 C120,48 132,32 148,30 C144,50 136,64 130,78 Z" fill={C.leafDark} />
      <path d="M120,78 C130,56 150,46 164,50 C152,62 138,70 132,78 Z" fill={C.leaf} />
    </>
  ),
  'carrot-small': (
    <>
      <Ground cy={190} rx={24} />
      <path d="M104,118 L136,118 L127,174 C126,182 114,182 113,174 Z" fill={C.orange} />
      <path d="M136,118 L127,174 C126,178 124,180 122,181 C126,160 129,138 130,118 Z" fill={C.orangeShade} opacity="0.5" />
      <path d="M109,136 h22 M111,156 h16" stroke={C.orangeShade} strokeWidth="3" opacity="0.5" strokeLinecap="round" />
      <path d="M120,118 C113,102 100,94 90,97 C98,106 107,112 112,118 Z" fill={C.leaf} />
      <path d="M120,118 C120,98 128,88 139,87 C136,100 130,110 126,118 Z" fill={C.leafDark} />
    </>
  ),
  'carrot-pale': (
    <>
      <Ground cy={202} rx={30} />
      <path d="M100,94 L140,94 L127,184 C126,194 114,194 113,184 Z" fill={C.orangePale} />
      <path d="M140,94 L127,184 C126,190 124,192 121,193 C126,164 131,130 132,94 Z" fill={C.orangeShade} opacity="0.35" />
      <path d="M106,120 h28 M109,146 h22" stroke={C.orangeShade} strokeWidth="3.5" opacity="0.4" strokeLinecap="round" />
      <path d="M120,94 C111,74 94,64 82,68 C93,79 104,86 110,94 Z" fill={C.leaf} />
      <path d="M120,94 C120,68 131,55 145,54 C141,71 134,83 129,94 Z" fill={C.leafDark} />
    </>
  ),

  // === DOGS ===============================================================
  // The textbook generalization case: these four share almost no surface
  // features, which is exactly why a child can learn one and not recognise
  // the next as the same kind of thing.
  'dog-brown': (
    <>
      <Ground cy={212} rx={62} />
      <path d="M76,208 C64,168 68,132 84,116 L156,116 C172,132 176,168 164,208 Z" fill={C.brown} />
      <circle cx="120" cy="96" r="52" fill={C.brown} />
      <path d="M76,66 C58,60 48,84 54,112 C60,136 76,136 82,120 Z" fill={C.brownDark} />
      <path d="M164,66 C182,60 192,84 186,112 C180,136 164,136 158,120 Z" fill={C.brownDark} />
      <ellipse cx="120" cy="116" rx="26" ry="20" fill={C.cream} />
      <Face cx={120} cy={94} s={1.15} />
      <path d="M164,208 C186,196 190,172 182,160" stroke={C.brown} strokeWidth="15" fill="none" strokeLinecap="round" />
    </>
  ),
  'dog-white-fluffy': (
    <>
      <Ground cy={196} rx={44} />
      <circle cx="120" cy="158" r="38" fill={C.white} />
      <circle cx="120" cy="112" r="42" fill={C.white} />
      <path d="M92,80 C78,64 66,72 68,92 C70,108 84,112 92,102 Z" fill={C.creamShade} />
      <path d="M148,80 C162,64 174,72 172,92 C170,108 156,112 148,102 Z" fill={C.creamShade} />
      <circle cx="94" cy="150" r="14" fill={C.white} />
      <circle cx="146" cy="150" r="14" fill={C.white} />
      <Face cx={120} cy={112} s={0.95} />
      <Gloss cx={100} cy={94} rx={12} ry={16} />
    </>
  ),
  'dog-spotted': (
    <>
      <Ground cy={208} rx={66} />
      <path d="M62,204 C54,168 60,136 80,124 L160,124 C180,136 186,168 178,204 Z" fill={C.white} />
      <circle cx="120" cy="102" r="46" fill={C.white} />
      <path d="M80,74 C62,72 56,98 66,118 C74,134 88,130 92,116 Z" fill={C.ink} />
      <path d="M160,74 C178,72 184,98 174,118 C166,134 152,130 148,116 Z" fill={C.ink} />
      <circle cx="86" cy="164" r="17" fill={C.ink} opacity="0.85" />
      <circle cx="156" cy="180" r="13" fill={C.ink} opacity="0.85" />
      <circle cx="146" cy="96" r="13" fill={C.ink} opacity="0.8" />
      <Face cx={120} cy={102} s={1.05} />
    </>
  ),
  'dog-long-tan': (
    <>
      <Ground cy={206} rx={80} />
      <rect x="46" y="140" width="150" height="52" rx="26" fill={C.golden} />
      <circle cx="184" cy="124" r="36" fill={C.golden} />
      <path d="M170,96 C158,84 148,96 152,116 C155,130 166,130 170,120 Z" fill={C.goldenShade} />
      <path d="M198,96 C210,84 220,96 216,116 C213,130 202,130 198,120 Z" fill={C.goldenShade} />
      <rect x="62" y="184" width="18" height="24" rx="9" fill={C.goldenShade} />
      <rect x="160" y="184" width="18" height="24" rx="9" fill={C.goldenShade} />
      <path d="M46,158 C28,150 22,132 28,122" stroke={C.golden} strokeWidth="13" fill="none" strokeLinecap="round" />
      <Face cx={184} cy={124} s={0.85} />
    </>
  ),

  // === CATS ===============================================================
  'cat-ginger': (
    <>
      <Ground cy={210} rx={54} />
      <path d="M82,206 C74,168 80,134 96,122 L144,122 C160,134 166,168 158,206 Z" fill={C.orange} />
      <circle cx="120" cy="102" r="46" fill={C.orange} />
      <path d="M80,74 L74,32 L110,58 Z" fill={C.orange} />
      <path d="M160,74 L166,32 L130,58 Z" fill={C.orange} />
      <path d="M84,44 L80,26 L98,40 Z" fill={C.lightRed} opacity="0.6" />
      <path d="M156,44 L160,26 L142,40 Z" fill={C.lightRed} opacity="0.6" />
      <path d="M96,92 h20 M124,92 h20" stroke={C.orangeShade} strokeWidth="5" strokeLinecap="round" />
      <Face cx={120} cy={104} s={1.0} />
      <path d="M158,204 C184,196 194,170 186,150" stroke={C.orange} strokeWidth="14" fill="none" strokeLinecap="round" />
    </>
  ),
  'cat-black': (
    <>
      <Ground cy={214} rx={58} />
      <path d="M84,210 C74,164 80,124 98,110 L142,110 C160,124 166,164 156,210 Z" fill={C.ink} />
      <circle cx="120" cy="88" r="48" fill={C.ink} />
      <path d="M80,58 L72,14 L110,42 Z" fill={C.ink} />
      <path d="M160,58 L168,14 L130,42 Z" fill={C.ink} />
      <Face cx={120} cy={88} s={1.05} dark={C.golden} />
      <path d="M156,208 C186,200 198,168 188,142" stroke={C.ink} strokeWidth="15" fill="none" strokeLinecap="round" />
    </>
  ),
  'cat-grey': (
    <>
      <Ground cy={198} rx={46} />
      <ellipse cx="120" cy="158" rx="46" ry="38" fill={C.grey} />
      <circle cx="120" cy="118" r="40" fill={C.grey} />
      <path d="M88,94 L82,60 L112,82 Z" fill={C.grey} />
      <path d="M152,94 L158,60 L128,82 Z" fill={C.grey} />
      <ellipse cx="120" cy="168" rx="26" ry="18" fill={C.white} opacity="0.55" />
      <Face cx={120} cy={118} s={0.9} />
      <path d="M164,176 C182,170 188,152 182,140" stroke={C.greyShade} strokeWidth="12" fill="none" strokeLinecap="round" />
    </>
  ),

  // === BIRDS ==============================================================
  'bird-blue': (
    <>
      <Ground cy={200} rx={40} />
      <ellipse cx="118" cy="150" rx="44" ry="40" fill={C.blue} />
      <circle cx="146" cy="112" r="28" fill={C.blue} />
      <path d="M172,110 L196,118 L172,126 Z" fill={C.golden} />
      <path d="M100,146 C86,158 88,178 104,182 C118,185 128,170 124,154 Z" fill={C.blueShade} />
      <path d="M74,150 C58,140 52,152 62,164" stroke={C.blueShade} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="152" cy="106" r="4.5" fill={C.ink} />
      <path d="M110,190 v12 M132,190 v12" stroke={C.golden} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  'bird-red': (
    <>
      <Ground cy={208} rx={52} />
      <ellipse cx="116" cy="148" rx="56" ry="52" fill={C.deepRed} />
      <circle cx="150" cy="102" r="32" fill={C.deepRed} />
      <path d="M138,68 L156,48 L164,74 Z" fill={C.deepRedShade} />
      <path d="M180,102 L208,112 L180,122 Z" fill={C.golden} />
      <path d="M96,142 C80,156 82,180 100,186 C116,190 128,172 122,152 Z" fill={C.deepRedShade} />
      <circle cx="157" cy="96" r="5" fill={C.ink} />
      <path d="M104,198 v12 M132,198 v12" stroke={C.golden} strokeWidth="7" strokeLinecap="round" />
    </>
  ),
  'bird-yellow': (
    <>
      <Ground cy={196} rx={44} />
      <ellipse cx="112" cy="146" rx="38" ry="34" fill={C.ballYellow} />
      <circle cx="138" cy="116" r="24" fill={C.ballYellow} />
      <path d="M160,114 L182,121 L160,128 Z" fill={C.orange} />
      <path d="M76,152 C48,168 40,196 56,200 C72,203 92,180 96,158 Z" fill={C.bananaShade} />
      <path d="M96,142 C84,152 86,168 98,171 C108,173 116,161 113,148 Z" fill={C.bananaShade} opacity="0.7" />
      <circle cx="144" cy="111" r="4" fill={C.ink} />
      <path d="M106,178 v12 M124,178 v12" stroke={C.orange} strokeWidth="5" strokeLinecap="round" />
    </>
  ),

  // === TEDDIES ============================================================
  // The sharpest near miss in the library: it looks like an animal and is
  // not one. Stitching and a fabric muzzle are the only honest tells.
  'teddy-brown': (
    <>
      <Ground cy={212} rx={62} />
      <circle cx="74" cy="66" r="24" fill={C.brown} />
      <circle cx="166" cy="66" r="24" fill={C.brown} />
      <circle cx="74" cy="66" r="12" fill={C.creamShade} />
      <circle cx="166" cy="66" r="12" fill={C.creamShade} />
      <circle cx="120" cy="92" r="50" fill={C.brown} />
      <ellipse cx="120" cy="152" rx="56" ry="52" fill={C.brown} />
      <ellipse cx="120" cy="160" rx="34" ry="32" fill={C.creamShade} />
      <ellipse cx="120" cy="108" rx="24" ry="18" fill={C.creamShade} />
      <Face cx={120} cy={90} s={1.1} />
      <path d="M120,120 v10" stroke={C.brownDark} strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  'teddy-cream': (
    <>
      <Ground cy={210} rx={50} />
      <circle cx="84" cy="60" r="20" fill={C.cream} />
      <circle cx="156" cy="60" r="20" fill={C.cream} />
      <circle cx="120" cy="86" r="44" fill={C.cream} />
      <ellipse cx="120" cy="152" rx="44" ry="54" fill={C.cream} />
      <ellipse cx="120" cy="158" rx="26" ry="34" fill={C.creamShade} opacity="0.7" />
      <ellipse cx="120" cy="100" rx="20" ry="15" fill={C.creamShade} />
      <Face cx={120} cy={84} s={1.0} />
      <path d="M96,196 h48" stroke={C.creamShade} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  'teddy-grey': (
    <>
      <Ground cy={198} rx={42} />
      <circle cx="90" cy="96" r="17" fill={C.grey} />
      <circle cx="150" cy="96" r="17" fill={C.grey} />
      <circle cx="120" cy="116" r="36" fill={C.grey} />
      <ellipse cx="120" cy="166" rx="38" ry="32" fill={C.grey} />
      <ellipse cx="120" cy="170" rx="22" ry="19" fill={C.white} opacity="0.6" />
      <ellipse cx="120" cy="130" rx="17" ry="13" fill={C.white} opacity="0.7" />
      <Face cx={120} cy={113} s={0.85} />
    </>
  ),

  // === BALLS ==============================================================
  // Real KINDS of ball rather than one ball recoloured — see BALL's note in
  // conceptLibrary.ts. The basketball doubles as the sharpest near miss for
  // a navel orange: same size, same colour, same roundness, and the only
  // honest tells are the seams and the missing pitted skin.
  'ball-basketball': (
    <>
      <Ground cy={214} rx={72} />
      <circle cx="120" cy="130" r="78" fill={C.orange} />
      <path d="M120,52 v156" stroke={C.ink} strokeWidth="5" />
      <path d="M42,130 h156" stroke={C.ink} strokeWidth="5" />
      <path d="M62,74 C92,104 92,156 62,186" fill="none" stroke={C.ink} strokeWidth="5" />
      <path d="M178,74 C148,104 148,156 178,186" fill="none" stroke={C.ink} strokeWidth="5" />
      <path d="M120,208 A78,78 0 0,0 194,158 A150,150 0 0,1 120,208 Z" fill={C.shadow} opacity="0.12" />
      <Gloss cx={86} cy={94} rx={19} ry={27} />
    </>
  ),
  'ball-soccer': (
    <>
      <Ground cy={214} rx={72} />
      <circle cx="120" cy="130" r="78" fill={C.white} />
      <path d="M120,92 L152,116 L140,154 L100,154 L88,116 Z" fill={C.ink} />
      <path d="M120,52 L96,64 L88,110 L120,92 L152,110 L144,64 Z" fill={C.ink} opacity="0.9" />
      <path d="M50,104 L88,116 L100,154 L70,178 L46,142 Z" fill={C.ink} opacity="0.9" />
      <path d="M190,104 L152,116 L140,154 L170,178 L194,142 Z" fill={C.ink} opacity="0.9" />
      <path d="M100,154 L110,200 L130,200 L140,154 Z" fill={C.ink} opacity="0.9" />
      <circle cx="120" cy="130" r="78" fill="none" stroke={C.greyShade} strokeWidth="3" />
      <Gloss cx={82} cy={90} rx={16} ry={22} />
    </>
  ),
  'ball-volleyball': (
    <>
      <Ground cy={202} rx={58} />
      <circle cx="120" cy="140" r="62" fill={C.white} />
      <path d="M120,78 C96,108 94,172 112,200" fill="none" stroke={C.ballBlue} strokeWidth="7" />
      <path d="M120,78 C144,108 146,172 128,200" fill="none" stroke={C.ballBlue} strokeWidth="7" />
      <path d="M60,152 C92,142 148,142 180,152" fill="none" stroke={C.ballBlue} strokeWidth="7" />
      <path d="M62,116 C94,126 146,126 178,116" fill="none" stroke={C.ballBlue} strokeWidth="7" />
      <circle cx="120" cy="140" r="62" fill="none" stroke={C.greyShade} strokeWidth="3" />
      <Gloss cx={92} cy={110} rx={14} ry={19} />
    </>
  ),
  'ball-tennis': (
    <>
      <Ground cy={192} rx={38} />
      <circle cx="120" cy="152" r="42" fill={C.ballGreen} />
      <path d="M82,140 C104,152 104,178 92,188" fill="none" stroke={C.white} strokeWidth="5" />
      <path d="M158,140 C136,152 136,178 148,188" fill="none" stroke={C.white} strokeWidth="5" />
      <path d="M120,194 A42,42 0 0,0 160,124 A80,80 0 0,1 120,194 Z" fill={C.shadow} opacity="0.12" />
      <Gloss cx={104} cy={130} rx={10} ry={14} />
    </>
  ),
  'ball-beach': (
    <>
      <Ground cy={212} rx={70} />
      <circle cx="120" cy="134" r="74" fill={C.white} />
      <path d="M120,60 A74,74 0 0,1 176,96 L120,134 Z" fill={C.ballRed} />
      <path d="M176,96 A74,74 0 0,1 176,172 L120,134 Z" fill={C.ballYellow} />
      <path d="M176,172 A74,74 0 0,1 120,208 L120,134 Z" fill={C.ballBlue} />
      <path d="M120,208 A74,74 0 0,1 64,172 L120,134 Z" fill={C.ballGreen} />
      <path d="M64,172 A74,74 0 0,1 64,96 L120,134 Z" fill={C.orange} />
      <circle cx="120" cy="134" r="16" fill={C.white} />
      <circle cx="120" cy="134" r="74" fill="none" stroke={C.greyShade} strokeWidth="3" />
      <Gloss cx={88} cy={100} rx={16} ry={22} />
    </>
  ),

  // === CARS ===============================================================
  'car-red': (
    <>
      <Ground cy={202} rx={76} />
      <path d="M30,168 v-26 c0-13 9-22 22-22 h18 l30-38 c5-7 13-11 22-11 h56 c13,0 24,8 27,18 l16,31 h14 c13,0 21,9 21,22 v26 Z" fill={C.deepRed} />
      <path d="M118,90 h48 l14,30 h-62 Z" fill={C.glass} />
      <path d="M108,90 l-24,30 h24 Z" fill={C.glass} />
      <circle cx="76" cy="170" r="28" fill={C.tyre} />
      <circle cx="176" cy="170" r="28" fill={C.tyre} />
      <circle cx="76" cy="170" r="12" fill={C.grey} />
      <circle cx="176" cy="170" r="12" fill={C.grey} />
    </>
  ),
  'car-blue-truck': (
    <>
      <Ground cy={208} rx={86} />
      <rect x="98" y="86" width="122" height="86" rx="10" fill={C.blue} />
      <path d="M20,172 v-42 c0-11 8-20 19-20 h30 l22-32 h11 v94 Z" fill={C.blueShade} />
      <path d="M50,112 h30 v26 h-44 Z" fill={C.glass} />
      <rect x="98" y="86" width="122" height="20" rx="8" fill={C.blueShade} />
      <circle cx="66" cy="176" r="30" fill={C.tyre} />
      <circle cx="176" cy="176" r="30" fill={C.tyre} />
      <circle cx="66" cy="176" r="13" fill={C.grey} />
      <circle cx="176" cy="176" r="13" fill={C.grey} />
    </>
  ),
  'car-yellow-small': (
    <>
      <Ground cy={186} rx={56} />
      <path d="M56,158 v-18 c0-10 7-17 17-17 h6 l20-26 c4-5 10-8 16-8 h30 c9,0 17,6 20,13 l9,21 h6 c10,0 17,7 17,17 v18 Z" fill={C.ballYellow} />
      <path d="M120,100 h26 l9,22 h-35 Z" fill={C.glass} />
      <path d="M112,100 l-16,22 h16 Z" fill={C.glass} />
      <circle cx="88" cy="160" r="20" fill={C.tyre} />
      <circle cx="156" cy="160" r="20" fill={C.tyre} />
      <circle cx="88" cy="160" r="8" fill={C.grey} />
      <circle cx="156" cy="160" r="8" fill={C.grey} />
    </>
  ),
};

/**
 * One concept variant, drawn at the caller's size.
 *
 * Callers MUST render every variant in a trial at the same `size` — the
 * artwork carries the small/medium/large difference internally (header
 * rule 1), so re-sizing per variant would double-count it and, worse, would
 * make the correct answer identifiable by its tile size alone.
 *
 * `aria-hidden` because the control around it is already labelled; without
 * it the name is announced twice.
 */
export function ConceptArt({
  variantId,
  size = '100%',
  silhouette = false,
}: {
  variantId: VariantId;
  size?: number | string;
  /**
   * Draw the shape only, in solid black.
   *
   * `brightness(0)` drives every colour channel to zero while leaving the
   * alpha channel untouched, so the artwork's own outline becomes the
   * silhouette exactly. This is the payoff of drawing the library as
   * vectors: games/silhouette.ts has to guess a luminance threshold over
   * photo pixels and admits in its own header that it fails on a cluttered
   * or low-contrast shot. Here there is nothing to guess and nothing to
   * fail — the shape is already known.
   */
  silhouette?: boolean;
}) {
  const art = ART[variantId];
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{
        display: 'block',
        overflow: 'visible',
        filter: silhouette ? 'brightness(0)' : undefined,
      }}
    >
      {art}
    </svg>
  );
}

// No non-component exports here on purpose: a second export breaks React
// Fast Refresh for the whole file (oxlint react(only-export-components)).
// Art coverage is checked two other ways instead — Record<VariantId, …>
// makes a missing drawing a compile error, and smoke-concepts.ts reads this
// file as text to confirm every declared variant appears in it.
