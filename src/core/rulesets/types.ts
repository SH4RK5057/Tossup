import type { Level, RulesetId } from '../types';

export interface Subject {
  name: string;
  /** Lowest level this subject is drawn at. Omitted = all levels. */
  level?: Level;
}
export interface SubjectCategory {
  name: string;
  subjects: Subject[];
}

export type CheckerStrictness = 'strict' | 'lenient';

export interface Ruleset {
  id: RulesetId;
  name: string;
  shortName: string;
  tossupValue: number;
  /** Points added for a wrong tossup answer (negative = penalty). */
  wrongTossupPoints: number;
  /** Default seconds to answer a tossup. */
  tossupSeconds: number;
  bonus: {
    minParts: number;
    maxParts: number;
    /** together: all parts shown at once under one clock. sequential: one part at a time. */
    timing: 'together' | 'sequential';
    /** together: seconds for the whole bonus. sequential: seconds per part. */
    defaultSeconds: number;
    pointsPerPart: number;
  };
  /** Match simulation. clock: game clock in minutes per level. count: fixed tossup count. */
  match:
    | { kind: 'clock'; minutes: Record<Level, number>; maxTossups: number }
    | { kind: 'count'; tossups: number };
  /** Fixed number of current-events tossups per full-distribution match, per level. null = none. */
  currentEvents: Record<Level, number> | null;
  /** Tossup count that the currentEvents numbers are defined against (for shorter sessions they scale down). */
  currentEventsReferenceLength: number;
  checker: CheckerStrictness;
  /** Cumulative pools: fraction of questions drawn from lower levels. null = no cumulative pools. */
  lowerLevelShare: number | null;
  /** Relative weights by category for "Full distribution" (current events handled by currentEvents). */
  distribution: Record<string, number>;
  subjects: SubjectCategory[];
}
