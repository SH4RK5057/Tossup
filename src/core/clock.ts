// Length-scaled tossup clock. Pure.
//
// In the real game you hear the question (that time is free), then have 5 seconds to buzz in, and once
// you buzz you have 3 seconds to answer aloud. Typed play shows the whole question at once with one clock,
// so it covers reading, the 5 seconds to start answering, and typing the answer (at least the 3 seconds
// you would have had to speak it).

export const PACES = ['official', 'relaxed', 'generous'] as const;
export type Pace = (typeof PACES)[number];
export const PACE_MULTIPLIER: Record<Pace, number> = { official: 1, relaxed: 1.3, generous: 1.6 };
export const PACE_LABEL: Record<Pace, string> = {
  official: 'Official-like', relaxed: 'Relaxed (×1.3)', generous: 'Generous (×1.6)',
};

/** Silent reading speed, words per second (about 240 wpm). */
export const READ_WORDS_PER_SECOND = 4;
/** Official: 5 seconds after the question is read to buzz in (here: to start answering). */
export const THINK_SECONDS = 5;
/** Typing speed, characters per second (about 40 wpm). */
export const TYPE_CHARS_PER_SECOND = 3.3;
/** Official: 3 seconds to give the answer once you have buzzed in; typing is never allowed less. */
export const MIN_TYPING_SECONDS = 3;
export const MIN_CLOCK_SECONDS = 5;
export const MAX_CLOCK_SECONDS = 60;

export interface ClockQuestion {
  text: string;
  answer: string;
  answer_type: 'general' | 'name' | 'math' | 'foreign_language';
}

/**
 * Seconds allowed for a tossup. `includeReading` is false for the "More specific?" follow-up, where the
 * question has already been read.
 */
export function scaledTossupSeconds(q: ClockQuestion, multiplier: number, includeReading = true): number {
  const words = q.text.trim().split(/\s+/).filter(Boolean).length;
  const reading = includeReading ? words / READ_WORDS_PER_SECOND : 0;
  const typing = Math.max(MIN_TYPING_SECONDS, q.answer.length / TYPE_CHARS_PER_SECOND);
  // Math needs working out and foreign-language answers have awkward characters to type.
  const extra = q.answer_type === 'math' ? 3 : q.answer_type === 'foreign_language' ? 2 : 0;
  const total = (reading + THINK_SECONDS + typing + extra) * multiplier;
  return Math.min(MAX_CLOCK_SECONDS, Math.max(MIN_CLOCK_SECONDS, Math.ceil(total)));
}
