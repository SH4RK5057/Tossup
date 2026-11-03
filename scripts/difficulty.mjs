// Shared difficulty tagging for the seed and batch builders.
// Difficulty is relative to the question's level and set by index within each ruleset-level set
// (file order, tossups and bonuses counted separately); unlisted indices are medium.

/** map: { 'ncal-novice': { easy: [], hard: [], bonusEasy: [], bonusHard: [] }, ... } */
export function tagDifficulty(rows, map) {
  const counters = {};
  for (const r of rows) {
    const key = `${r.rulesets[0]}-${r.level}`;
    const slot = `${key}-${r.type}`;
    const i = (counters[slot] = (counters[slot] ?? -1) + 1);
    const m = map[key] ?? {};
    const easy = r.type === 'tossup' ? m.easy : m.bonusEasy;
    const hard = r.type === 'tossup' ? m.hard : m.bonusHard;
    r.difficulty = easy?.includes(i) ? 'easy' : hard?.includes(i) ? 'hard' : 'medium';
  }
  return rows;
}
