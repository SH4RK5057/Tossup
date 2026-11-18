// Compact question format for the big bank (see GOAL.md).
//
//   # <ruleset> <level> | <Category> | <Subcategory>      sets the cell for the lines below
//   e|<text>|<answer>|<alt1;alt2>|<opts>                   a tossup (e/m/h = difficulty)
//   B|m|<lead-in>                                          starts a bonus (overall difficulty)
//   -|e|<text>|<answer>|<alts>|<opts>                      one bonus part (e/m/h = part difficulty)
//
// opts (space separated): n (name; last word of the answer is the surname) | n=Surname | m (math) |
//   f (foreign language) | dup (duplicate surname) | part (accepts partial name) | p=Prompt1;Prompt2 |
//   ok (answer legitimately appears in the question, e.g. "which word in this sentence is the verb?")
// Do not use "|" inside text. Blank lines and lines starting with "//" are ignored.

export const SOURCE = 'ai-claude-bank';
const DIFF = { e: 'easy', m: 'medium', h: 'hard' };

function spec(answer, alts, opts) {
  const s = {
    answer, required: null, alternates: alts ? alts.split(';').map((x) => x.trim()).filter(Boolean) : [],
    prompt_on: [], answer_type: 'general', duplicate_name: false, accepts_partial_name: false,
  };
  for (const o of (opts ?? '').split(/\s+/).filter(Boolean)) {
    if (o === 'n') { s.answer_type = 'name'; s.required = answer.trim().split(/\s+/).pop(); }
    else if (o.startsWith('n=')) { s.answer_type = 'name'; s.required = o.slice(2); }
    else if (o === 'm') s.answer_type = 'math';
    else if (o === 'f') s.answer_type = 'foreign_language';
    else if (o === 'dup') s.duplicate_name = true;
    else if (o === 'part') s.accepts_partial_name = true;
    else if (o === 'ok') s._leakOk = true; // the answer legitimately appears in the question (e.g. "which word is the verb?")
    else if (o.startsWith('p=')) s.prompt_on = o.slice(2).split(';').map((x) => x.trim()).filter(Boolean);
    else throw new Error(`unknown option "${o}"`);
  }
  return s;
}

export function parseBank(text, file = 'bank') {
  const rows = [];
  let cell = null;
  let bonus = null;
  const fail = (n, msg) => { throw new Error(`${file}:${n}: ${msg}`); };
  text.split(/\r?\n/).forEach((raw, idx) => {
    const n = idx + 1;
    const line = raw.trim();
    if (!line || line.startsWith('//')) return;
    if (line.startsWith('#')) {
      const [head, category, subcategory] = line.slice(1).split('|').map((x) => x.trim());
      const [rulesetId, level] = head.split(/\s+/);
      if (!rulesetId || !level || !category || !subcategory) fail(n, 'bad cell header');
      cell = { rulesetId, level, category, subcategory };
      bonus = null;
      return;
    }
    if (!cell) fail(n, 'question before any # header');
    const base = {
      rulesets: [cell.rulesetId], level: cell.level, category: cell.category, subcategory: cell.subcategory,
      source: SOURCE, expires_at: null,
    };
    const f = line.split('|');
    if (f[0] === 'B') {
      if (f.length !== 3 || !DIFF[f[1]]) fail(n, 'bonus line is B|d|leadin');
      bonus = { type: 'bonus', ...base, difficulty: DIFF[f[1]], leadin: f[2].trim(), parts: [] };
      rows.push(bonus);
    } else if (f[0] === '-') {
      if (!bonus) fail(n, 'bonus part without a bonus');
      if (f.length < 4 || !DIFF[f[1]]) fail(n, 'part line is -|d|text|answer|alts|opts');
      bonus.parts.push({ text: f[2].trim(), part_difficulty: DIFF[f[1]], ...spec(f[3].trim(), f[4], f[5]) });
    } else if (DIFF[f[0]]) {
      bonus = null;
      if (f.length < 3) fail(n, 'tossup line is d|text|answer|alts|opts');
      rows.push({ type: 'tossup', ...base, difficulty: DIFF[f[0]], text: f[1].trim(), ...spec(f[2].trim(), f[3], f[4]) });
    } else {
      fail(n, `unrecognized line start "${f[0]}"`);
    }
  });
  return rows;
}
