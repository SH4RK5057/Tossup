import type { RulesetId } from '../types';
import { ncal } from './ncal';
import { quizbowl } from './quizbowl';
import type { Ruleset } from './types';

export const RULESETS: Record<RulesetId, Ruleset> = { ncal, quizbowl };
export const DEFAULT_RULESET: RulesetId = 'ncal';
export function getRuleset(id: RulesetId): Ruleset { return RULESETS[id]; }
export type { Ruleset, SubjectCategory, Subject } from './types';
