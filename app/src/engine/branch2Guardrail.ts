// F.015 — the §9.4 output guardrail. A REAL post-generation check, not
// prompt wording. Runs on the model's generated observation text before it
// is ever assembled into a card or shown to a parent.
//
// "If the check fails, the card is not shown. The parent is offered the raw
// text of their own words instead. Degrading to the parent's own sentence
// is always safe; a hallucinated symptom never is." (§9.4)
//
// That asymmetry is why this list is deliberately BROAD rather than
// minimal: a false positive here just means "show the parent their own
// words instead" (always safe). A false negative means a hallucinated or
// risk-framed sentence reaches a parent (never safe). When in doubt, ban it.
//
// §9.4's exact banned list, plus reasonable extensions in the same spirit
// (documented inline). Word-boundary matching throughout, so this never
// flags a substring inside an unrelated word (e.g. "risk" must not match
// "brisk" -- see the smoke test for exactly this case).

export interface GuardrailResult {
  passed: boolean;
  /** Human-readable reasons the check failed. Empty when passed is true. */
  reasons: string[];
}

// §9.4's exact banned words, verbatim.
const BANNED_WORDS = [
  'delayed',
  'disorder',
  'risk',
  'concerning',
  'abnormal',
  'symptom',
  'likely',
  'probably',
  'suggests',
] as const;

// Common condition/diagnostic terms. Not from a single canonical list --
// deliberately broad, because naming ANY condition is an absolute ban
// (§9.4: "any condition name"), and the safe failure mode is "show the
// parent their own words" either way. Expressed as explicit regexes (not
// run through wordBoundaryRegex below) because several of these are
// deliberate STEMS -- `\bautis\w*` must match "autism" and "autistic", which
// a strict \bautis\b would miss entirely (no word boundary between "autis"
// and "m"). Getting this wrong the other way (over-matching) is still safe
// -- see the module doc comment -- so these lean broad on purpose.
const CONDITION_PATTERNS: RegExp[] = [
  /\bautis\w*/i, // autism, autistic, autism spectrum
  /\basperger'?s?\b/i,
  /\badhd\b/i,
  /\badd\b/i, // as the acronym "ADD" (attention deficit disorder)
  /\bdown'?s?\s+syndrome\b/i,
  /\bcerebral palsy\b/i,
  /\bdyspraxi\w*/i,
  /\bapraxi\w*/i,
  /\bdyslexi\w*/i,
  /\bdysgraphi\w*/i,
  /\bdyscalculi\w*/i,
  /\bspectrum disorder\b/i,
  /\bdevelopmental disabilit\w*/i,
  /\bdevelopmental delay\b/i,
  /\bglobal developmental delay\b/i,
  /\bintellectual disabilit\w*/i,
  /\bsensory processing\b/i,
  /\bspeech delay\b/i,
  /\blanguage delay\b/i,
  /\boppositional defiant\b/i,
  /\bodd\b/i,
  /\banxiety disorder\b/i,
  /\bcommunication disorder\b/i,
  /\blearning disabilit\w*/i,
  /\bregression\b/i,
  /\bnon-?verbal\b/i, // a clinical label for the child, not phrasing a parent's own raw words would use
];

// Severity, probability, percentage -- "any severity, probability or
// percentage" (§9.4). Word-boundary + numeric patterns.
const SEVERITY_PATTERNS: RegExp[] = [
  /\d+\s?%/, // any percentage figure
  /\bpercent(age)?\b/i,
  /\b(mild|moderate|severe|significant|substantial)\b/i,
  /\bchance(s)?\b/i,
  /\bprobability\b/i,
  /\bodds\b/i,
  /\bhigh(ly)?\s+likely\b/i,
];

// "Any recommendation beyond 'ask a health worker'" (§9.4). The three fixed
// questions already cover the sanctioned recommendation; anything the MODEL
// itself recommends is out of bounds.
const RECOMMENDATION_PATTERNS: RegExp[] = [
  /\brecommend(s|ed|ation)?\b/i,
  /\bshould\s+(see|consult|visit|seek|book|schedule|start|try|get)\b/i,
  /\bneeds?\s+(therapy|treatment|intervention|medication|evaluation|assessment)\b/i,
  /\bmust\s+(see|consult|visit)\b/i,
  /\brefer(ral)?\s+to\s+a\s+(specialist|therapist|psychologist|psychiatrist|paediatrician|pediatrician)\b/i,
  /\bwe\s+recommend\b/i,
  /\burgent(ly)?\b/i,
];

// Only ever fed plain literal words from BANNED_WORDS -- the condition list
// uses explicit RegExp objects above instead, since several of those need
// deliberate stem/prefix matching that a blanket \bword\b wrap would break.
function wordBoundaryRegex(word: string): RegExp {
  return new RegExp(`\\b${word}\\b`, 'i');
}

/**
 * The §9.4 guardrail. Checks generated text (the model's observation
 * paragraph -- see engine/branch2Card.ts) for anything that must never
 * reach a parent. Returns every reason it failed, not just the first, so a
 * failure is debuggable rather than a bare boolean.
 */
export function checkCardGuardrail(text: string): GuardrailResult {
  const reasons: string[] = [];

  for (const word of BANNED_WORDS) {
    if (wordBoundaryRegex(word).test(text)) {
      reasons.push(`banned word: "${word}"`);
    }
  }

  for (const pattern of CONDITION_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`condition-adjacent term: ${pattern}`);
    }
  }

  for (const pattern of SEVERITY_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`severity/probability/percentage pattern: ${pattern}`);
    }
  }

  for (const pattern of RECOMMENDATION_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`recommendation beyond "ask a health worker": ${pattern}`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
