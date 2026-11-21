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

/** Official bonus: 20 seconds to confer after the bonus is read. */
export const BONUS_CONFER_SECONDS = 20;
/** Official bonus: about 5 seconds to give the answers; typing is never allowed less. */
export const BONUS_MIN_ANSWER_SECONDS = 5;
export const MAX_BONUS_CLOCK_SECONDS = 180;

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

export interface ClockBonus {
  leadin: string;
  parts: { text: string; answer: string; answer_type: ClockQuestion['answer_type'] }[];
}

/**
 * Seconds for a bonus whose parts are all shown at once: reading the lead-in and every part, the 20 seconds
 * to confer, then typing all the answers (at least the ~5 seconds you would have had to say them).
 */
export function scaledBonusSeconds(b: ClockBonus, multiplier: number): number {
  const words = [b.leadin, ...b.parts.map((p) => p.text)].join(' ').split(/\s+/).filter(Boolean).length;
  const reading = words / READ_WORDS_PER_SECOND;
  const chars = b.parts.reduce((n, p) => n + p.answer.length, 0);
  const typing = Math.max(BONUS_MIN_ANSWER_SECONDS, chars / TYPE_CHARS_PER_SECOND);
  const extra = b.parts.reduce((n, p) => n + (p.answer_type === 'math' ? 3 : p.answer_type === 'foreign_language' ? 2 : 0), 0);
  const total = (reading + BONUS_CONFER_SECONDS + typing + extra) * multiplier;
  return Math.min(MAX_BONUS_CLOCK_SECONDS, Math.max(MIN_CLOCK_SECONDS, Math.ceil(total)));
}

/** Official: once you have buzzed in you have 3 seconds to answer. Typed: 3 seconds to start, plus typing time. */
export const BUZZ_ANSWER_SECONDS = 3;

/** Seconds a player who has buzzed in gets to type the answer in a multiplayer room. */
export function buzzAnswerSeconds(q: Pick<ClockQuestion, 'answer' | 'answer_type'>): number {
  const typing = Math.max(MIN_TYPING_SECONDS, q.answer.length / TYPE_CHARS_PER_SECOND);
  const extra = q.answer_type === 'math' ? 3 : q.answer_type === 'foreign_language' ? 2 : 0;
  return Math.min(30, Math.max(MIN_CLOCK_SECONDS, Math.ceil(BUZZ_ANSWER_SECONDS + typing + extra)));
}
