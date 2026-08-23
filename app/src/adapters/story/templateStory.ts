// Deterministic fallback StoryGenPort (F.022 redesign). This is the
// fallback of last resort — engine/game2Story.ts's getOrGenerateStory()
// degrades to this on ANY failure of the real generator (network, malformed
// JSON, failed validation — see storyParsing.ts). It therefore must NEVER
// throw, must never make a network call, and must always produce something
// usable from whatever objects were actually detected.
//
// No fixed "bath time" / "bedtime" anchor concept here (that was the old
// routineSequencing.ts system this redesign replaces) — just one small,
// generic three-verb shape ("pick up" -> "play with" -> "put away") applied
// to up to 4 of the real detected objects, which reads as plausible for
// almost anything a preschooler would have lying around. Never invents an
// object that isn't really there, same principle the old anchor system
// followed.

import type { DetectedObjectForStory, GeneratedStoryTemplate, StoryGenPort, StoryStepTemplate } from '../ports';

const MAX_STEPS = 4;

/** Third-person form, for the default "{companion} verbs..." subject. */
function verbForPosition(index: number, count: number): string {
  if (index === 0) return 'picks up';
  if (index === count - 1) return 'puts away';
  return 'plays with';
}

/** Base/second-person form, for "You verb..." -- "you" takes the bare verb
 * ("you pick up", never "you picks up"), so this can't share
 * verbForPosition's third-person-singular forms. */
function verbForPositionSecondPerson(index: number, count: number): string {
  if (index === 0) return 'pick up';
  if (index === count - 1) return 'put away';
  return 'play with';
}

export function createTemplateStory(): StoryGenPort {
  return {
    async generateStory(input: {
      objects: DetectedObjectForStory[];
      stepCount?: number;
      perspective?: 'companion' | 'child';
    }): Promise<GeneratedStoryTemplate> {
      // Contract guarantees >=2 objects (see StoryGenPort's doc comment);
      // defensively still produce as many steps as objects allow if that's
      // ever violated, rather than crashing -- this generator must never
      // throw. A caregiver-chosen stepCount is honoured exactly, clamped
      // to what's actually possible -- unlike the real generator, this one
      // can't ask for more objects, so "exactly N" degrades to "as many as
      // there are, up to N" when N exceeds what's available.
      const target = input.stepCount
        ? Math.min(Math.max(Math.round(input.stepCount), 2), MAX_STEPS)
        : MAX_STEPS;
      const usable = input.objects.slice(0, Math.min(target, input.objects.length));
      const isChildPerspective = input.perspective === 'child';
      // No ordinal word/numbering in the sentence itself -- same rule as
      // the real generator's prompt (see STORY_PROMPT). Numbering is a
      // rendering decision the UI makes from array position, not
      // something baked into the text.
      const steps: StoryStepTemplate[] = usable.map((obj, i) => {
        if (isChildPerspective) {
          const verb = verbForPositionSecondPerson(i, usable.length);
          return { sentence: `You ${verb} the ${obj.name}.`, objectRef: obj.name };
        }
        const verb = verbForPosition(i, usable.length);
        return {
          sentence: `{companion} ${verb} the ${obj.name}.`,
          objectRef: obj.name,
        };
      });
      return { steps, source: 'fallback' };
    },
  };
}
