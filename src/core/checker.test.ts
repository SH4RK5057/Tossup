import { describe, expect, it } from 'vitest';
import { check } from './checker';
import { ncal } from './rulesets/ncal';
import { quizbowl } from './rulesets/quizbowl';
import { answerSpecSchema, type AnswerSpec } from './types';

const spec = (o: Partial<AnswerSpec> & { answer: string }): AnswerSpec => answerSpecSchema.parse(o);

const lincoln = spec({ answer: 'Abraham Lincoln', answer_type: 'name', required: 'Lincoln' });
const teddy = spec({
  answer: 'Theodore Roosevelt', answer_type: 'name', required: 'Roosevelt', duplicate_name: true,
  alternates: ['Teddy Roosevelt'], prompt_on: ['Roosevelt'],
});
const davinci = spec({
  answer: 'Leonardo da Vinci', answer_type: 'name', alternates: ['da Vinci', 'Leonardo'], accepts_partial_name: true,
});
const half = spec({ answer: '1/2', answer_type: 'math' });
const five = spec({ answer: '5', answer_type: 'math' });
const casa = spec({ answer: 'la casa', answer_type: 'foreign_language' });
const trna = spec({ answer: 'transfer RNA', alternates: ['tRNA'], prompt_on: ['RNA'] });

describe('normalization', () => {
  it('ignores case, whitespace, punctuation and diacritics', () => {
    expect(check('  RENÉ   descartes! ', spec({ answer: 'René Descartes', answer_type: 'name', required: 'Descartes' }), ncal)).toBe('correct');
    expect(check('Cafe', spec({ answer: 'Café' }), ncal)).toBe('correct');
  });
  it('drops a leading article for general answers', () => {
    const a = spec({ answer: 'The Tempest' });
    expect(check('tempest', a, ncal)).toBe('correct');
    expect(check('the tempest', a, ncal)).toBe('correct');
  });
  it('converts spelled-out numbers to digits', () => {
    expect(check('twenty-one', spec({ answer: '21' }), ncal)).toBe('correct');
    expect(check('Ninth Symphony', spec({ answer: '9th Symphony' }), ncal)).toBe('correct');
    expect(check('one hundred and five', spec({ answer: '105' }), ncal)).toBe('correct');
  });
  it('treats empty and whitespace answers as incorrect', () => {
    expect(check('', trna, ncal)).toBe('incorrect');
    expect(check('   ', half, quizbowl)).toBe('incorrect');
  });
});

describe('abbreviations', () => {
  it('expands common abbreviations on both sides', () => {
    expect(check('Mt. Everest', spec({ answer: 'Mount Everest' }), ncal)).toBe('correct');
    expect(check('Mount Everest', spec({ answer: 'Mt. Everest' }), ncal)).toBe('correct');
    expect(check('mt everest', spec({ answer: 'Mount Everest' }), quizbowl)).toBe('correct');
    expect(check('Ft. Sumter', spec({ answer: 'Fort Sumter' }), ncal)).toBe('correct');
    expect(check('Doctor Seuss', spec({ answer: 'Dr. Seuss', answer_type: 'name', required: 'Seuss' }), ncal)).toBe('correct');
    expect(check('Martin Luther King Jr', spec({ answer: 'Martin Luther King Junior', answer_type: 'name', required: 'King' }), ncal)).toBe('correct');
  });
  it('tells saint from street and expands versus', () => {
    expect(check('St. Louis', spec({ answer: 'Saint Louis' }), ncal)).toBe('correct');
    expect(check('Mount St. Helens', spec({ answer: 'Mount Saint Helens' }), ncal)).toBe('correct');
    expect(check('Baker St', spec({ answer: 'Baker Street' }), ncal)).toBe('correct');
    expect(check('Marbury vs. Madison', spec({ answer: 'Marbury v. Madison' }), ncal)).toBe('correct');
    expect(check('Marbury versus Madison', spec({ answer: 'Marbury v. Madison' }), ncal)).toBe('correct');
  });
  it('unifies U.S. and U.S.A. spellings', () => {
    expect(check('U.S.A.', spec({ answer: 'USA' }), ncal)).toBe('correct');
    expect(check('U.S.', spec({ answer: 'US' }), ncal)).toBe('correct');
  });
  it('does not make different words match', () => {
    expect(check('Mount Rushmore', spec({ answer: 'Mount Everest' }), ncal)).toBe('incorrect');
  });
});

describe('shortened answers', () => {
  it('accepts the key without its generic head noun', () => {
    expect(check('Louisiana', spec({ answer: 'Louisiana Purchase' }), ncal)).toBe('correct');
    expect(check('third', spec({ answer: 'third law' }), ncal)).toBe('correct');
    expect(check('Ninth', spec({ answer: 'Ninth Symphony' }), ncal)).toBe('correct');
    expect(check('Gettysburg', spec({ answer: 'Battle of Gettysburg' }), ncal)).toBe('correct');
    expect(check('Everest', spec({ answer: 'Mount Everest' }), ncal)).toBe('correct');
    expect(check('Michigan', spec({ answer: 'Lake Michigan' }), quizbowl)).toBe('correct');
    expect(check('Ming', spec({ answer: 'Ming dynasty' }), ncal)).toBe('correct');
  });
  it('does not accept only the generic noun, or a different head', () => {
    expect(check('war', spec({ answer: 'Cold War' }), ncal)).toBe('incorrect');
    expect(check('purchase', spec({ answer: 'Louisiana Purchase' }), ncal)).toBe('incorrect');
    expect(check('Alaska', spec({ answer: 'Louisiana Purchase' }), ncal)).toBe('incorrect');
    expect(check('World War', spec({ answer: 'World War II' }), ncal)).toBe('incorrect');
  });
});

describe('general answers', () => {
  it('matches exact, required, and alternates', () => {
    const a = spec({ answer: 'mitochondria', alternates: ['mitochondrion'] });
    expect(check('mitochondrion', a, ncal)).toBe('correct');
    expect(check('Mitochondria', a, quizbowl)).toBe('correct');
  });
  it('returns prompt for prompt_on and lets exact win over prompt', () => {
    expect(check('RNA', trna, ncal)).toBe('prompt');
    expect(check('tRNA', trna, ncal)).toBe('correct');
  });
  it('scales typo tolerance with answer length', () => {
    expect(check('mitochondira', spec({ answer: 'mitochondria' }), ncal)).toBe('correct'); // transposition
    expect(check('Saturm', spec({ answer: 'Saturn' }), ncal)).toBe('correct'); // 6 chars: 1 edit
    expect(check('Satrrm', spec({ answer: 'Saturn' }), ncal)).toBe('incorrect'); // 2 edits
    expect(check('Zeuz', spec({ answer: 'Zeus' }), ncal)).toBe('incorrect'); // under 5: no typos
    expect(check('photosynthesus', spec({ answer: 'photosynthesis' }), ncal)).toBe('correct');
    expect(check('photosinthesus', spec({ answer: 'photosynthesis' }), ncal)).toBe('correct'); // 2 edits on 14
    expect(check('fotosinthesus', spec({ answer: 'photosynthesis' }), ncal)).toBe('incorrect'); // 4 edits
  });
  it('never applies typo tolerance to numbers', () => {
    expect(check('1776', spec({ answer: '1775' }), ncal)).toBe('incorrect');
    expect(check('12345', spec({ answer: '12346' }), quizbowl)).toBe('incorrect');
  });
  it('does not accept a completely different answer', () => {
    expect(check('Jupiter', spec({ answer: 'Saturn' }), ncal)).toBe('incorrect');
  });
});

describe('name answers (NCAL strict)', () => {
  it('accepts a last name alone', () => {
    expect(check('Lincoln', lincoln, ncal)).toBe('correct');
  });
  it('accepts the full name and initials', () => {
    expect(check('Abraham Lincoln', lincoln, ncal)).toBe('correct');
    expect(check('A. Lincoln', lincoln, ncal)).toBe('correct');
  });
  it('makes a wrong first name incorrect', () => {
    expect(check('Robert Lincoln', lincoln, ncal)).toBe('incorrect');
  });
  it('requires the first name for duplicate_name and prompts on the bare surname', () => {
    expect(check('Theodore Roosevelt', teddy, ncal)).toBe('correct');
    expect(check('Teddy Roosevelt', teddy, ncal)).toBe('correct');
    expect(check('Roosevelt', teddy, ncal)).toBe('prompt');
    expect(check('Franklin Roosevelt', teddy, ncal)).toBe('incorrect');
  });
  it('duplicate_name without prompt_on makes a bare surname incorrect', () => {
    const noPrompt = spec({ ...teddy, prompt_on: [] });
    expect(check('Roosevelt', noPrompt, ncal)).toBe('incorrect');
  });
  it('accepts either part when accepts_partial_name', () => {
    expect(check('Leonardo', davinci, ncal)).toBe('correct');
    expect(check('da Vinci', davinci, ncal)).toBe('correct');
    expect(check('vinci', davinci, ncal)).toBe('correct');
    expect(check('Michelangelo', davinci, ncal)).toBe('incorrect');
  });
  it('tolerates typos in the surname', () => {
    expect(check('Lincon', lincoln, ncal)).toBe('correct');
    const dost = spec({ answer: 'Fyodor Dostoevsky', answer_type: 'name', required: 'Dostoevsky' });
    expect(check('Dostoyevski', dost, ncal)).toBe('correct');
  });
  it('handles multi-token last names and middle names', () => {
    const gogh = spec({ answer: 'Vincent van Gogh', answer_type: 'name', required: 'Gogh', alternates: ['van Gogh'] });
    expect(check('van Gogh', gogh, ncal)).toBe('correct');
    expect(check('Vincent Gogh', gogh, ncal)).toBe('correct');
    expect(check('Theo van Gogh', gogh, ncal)).toBe('incorrect');
    const fitz = spec({ answer: 'F. Scott Fitzgerald', answer_type: 'name', required: 'Fitzgerald' });
    expect(check('Francis Scott Fitzgerald', fitz, ncal)).toBe('correct');
  });
});

describe('name answers (quizbowl lenient)', () => {
  it('never penalizes first names', () => {
    expect(check('Robert Lincoln', lincoln, quizbowl)).toBe('correct');
    expect(check('Lincoln', lincoln, quizbowl)).toBe('correct');
  });
  it('still honors prompt_on for a duplicate surname', () => {
    expect(check('Roosevelt', teddy, quizbowl)).toBe('prompt');
  });
  it('does not accept the wrong surname', () => {
    expect(check('Jefferson', lincoln, quizbowl)).toBe('incorrect');
  });
});

describe('math answers', () => {
  it('accepts equal values in NCAL, but not an unreduced fraction', () => {
    expect(check('1/2', half, ncal)).toBe('correct');
    expect(check('2/4', half, ncal)).toBe('incorrect');
    expect(check('0.5', half, ncal)).toBe('correct');
    expect(check('1 / 2', half, ncal)).toBe('correct');
  });
  it('only accepts listed alternates', () => {
    const withAlt = spec({ answer: '1/2', answer_type: 'math', alternates: ['0.5'] });
    expect(check('0.5', withAlt, ncal)).toBe('correct');
  });
  it('rejects mixed-number forms when the key is improper', () => {
    const improper = spec({ answer: '3/2', answer_type: 'math' });
    expect(check('1 1/2', improper, ncal)).toBe('incorrect');
  });
  it('has no typo tolerance', () => {
    expect(check('55', five, ncal)).toBe('incorrect');
    expect(check('5', five, ncal)).toBe('correct');
  });
  it('strips trailing units from typed answers', () => {
    expect(check('180 degrees', spec({ answer: '180', answer_type: 'math' }), ncal)).toBe('correct');
    expect(check('12cm', spec({ answer: '12', answer_type: 'math' }), ncal)).toBe('correct');
    expect(check('50%', spec({ answer: '50', answer_type: 'math' }), ncal)).toBe('correct');
  });
  it('accepts spelled-out numbers', () => {
    expect(check('five', five, ncal)).toBe('correct');
    expect(check('thirty two', spec({ answer: '32', answer_type: 'math' }), ncal)).toBe('correct');
  });
  it('keeps pi and e symbolic', () => {
    const pi = spec({ answer: '2pi', answer_type: 'math' });
    expect(check('2π', pi, ncal)).toBe('correct');
    expect(check('2*pi', pi, ncal)).toBe('correct');
    expect(check('6.28', pi, ncal)).toBe('incorrect');
  });
  it('treats the radical sign and sqrt as the same form', () => {
    const r = spec({ answer: 'sqrt(3)/2', answer_type: 'math' });
    expect(check('√3/2', r, ncal)).toBe('correct');
    expect(check('sqrt3 / 2', r, ncal)).toBe('correct');
    expect(check('√(3)/2', r, ncal)).toBe('correct');
    expect(check('sqrt(2)/2', r, ncal)).toBe('incorrect');
    const two = spec({ answer: '2sqrt(3)', answer_type: 'math' });
    expect(check('2√3', two, ncal)).toBe('correct');
    expect(check('2*sqrt(3)', two, ncal)).toBe('correct');
  });
  it('normalizes multiplication and variable forms', () => {
    const d = spec({ answer: '2x', answer_type: 'math' });
    expect(check('2*x', d, ncal)).toBe('correct');
    expect(check('2 x', d, ncal)).toBe('correct');
    expect(check('x2', d, ncal)).toBe('incorrect');
  });
  it('compares numeric value in quizbowl when the key is a plain number', () => {
    expect(check('5.0', five, quizbowl)).toBe('correct');
    expect(check('10/2', five, quizbowl)).toBe('correct');
    expect(check('6', five, quizbowl)).toBe('incorrect');
    expect(check('5.0', five, ncal)).toBe('correct');
  });
  it('still compares forms in quizbowl when the key is a fraction', () => {
    expect(check('2/4', half, quizbowl)).toBe('incorrect');
  });
});

describe('foreign-language answers', () => {
  it('accepts the right article or none', () => {
    expect(check('la casa', casa, ncal)).toBe('correct');
    expect(check('casa', casa, ncal)).toBe('correct');
    expect(check('La Casa', casa, quizbowl)).toBe('correct');
  });
  it('makes a wrong article incorrect', () => {
    expect(check('el casa', casa, ncal)).toBe('incorrect');
    expect(check('una casa', casa, ncal)).toBe('incorrect');
  });
  it('has no typo tolerance', () => {
    expect(check('la caza', casa, ncal)).toBe('incorrect');
  });
  it('handles elided articles and diacritics', () => {
    const homme = spec({ answer: "l'homme", answer_type: 'foreign_language' });
    expect(check('l homme', homme, ncal)).toBe('correct');
    expect(check('homme', homme, ncal)).toBe('correct');
    expect(check('le homme', homme, ncal)).toBe('incorrect');
    const cafe = spec({ answer: 'le café', answer_type: 'foreign_language' });
    expect(check('le cafe', cafe, ncal)).toBe('correct');
  });
});

describe('seed data sanity', () => {
  it('accepts every seed answer under its own ruleset', async () => {
    const { default: seed } = await import('../../seed/questions.json');
    const { questionSchema } = await import('./types');
    for (const raw of seed as unknown[]) {
      const q = questionSchema.parse(raw);
      const rs = q.rulesets[0] === 'ncal' ? ncal : quizbowl;
      const specs = q.type === 'tossup' ? [q] : q.parts;
      for (const s of specs) {
        expect(check(s.answer, answerSpecSchema.parse(s), rs), `${q.id}: ${s.answer}`).toBe('correct');
        for (const alt of s.alternates) {
          expect(check(alt, answerSpecSchema.parse(s), rs), `${q.id} alt: ${alt}`).toBe('correct');
        }
      }
    }
  });
});

describe('math answer variations', () => {
  const m = (answer: string) => spec({ answer, answer_type: 'math' });
  it('accepts "x =" in front of a number, and without it', () => {
    expect(check('x = 7', m('7'), ncal)).toBe('correct');
    expect(check('x=7', m('7'), ncal)).toBe('correct');
    expect(check('7', m('x=7'), ncal)).toBe('correct');
  });
  it('accepts equal decimals and fractions, but not an unreduced fraction', () => {
    expect(check('0.25', m('1/4'), ncal)).toBe('correct');
    expect(check('.5', m('1/2'), ncal)).toBe('correct');
    expect(check('1/4', m('0.25'), ncal)).toBe('correct');
    expect(check('2/4', m('1/2'), ncal)).toBe('incorrect');
  });
  it('accepts thousands separators', () => {
    expect(check('64,000', m('64000'), ncal)).toBe('correct');
  });
  it('accepts a coordinate pair without parentheses', () => {
    expect(check('9, 5', m('(9,5)'), ncal)).toBe('correct');
    expect(check('(9, 5)', m('(9,5)'), ncal)).toBe('correct');
  });
  it('accepts spoken radicals, pi and exponents', () => {
    expect(check('2 root 2', m('2sqrt(2)'), ncal)).toBe('correct');
    expect(check('√3/2', m('sqrt(3)/2'), ncal)).toBe('correct');
    expect(check('36π', m('36pi'), ncal)).toBe('correct');
    expect(check('36 pi', m('36pi'), ncal)).toBe('correct');
    expect(check('6e to the x', m('6e^x'), ncal)).toBe('correct');
    expect(check('5e^5x', m('5e^(5x)'), ncal)).toBe('correct');
    expect(check('x²+2x', m('x^2+2x'), ncal)).toBe('correct');
  });
  it('still rejects wrong answers', () => {
    expect(check('x = 8', m('7'), ncal)).toBe('incorrect');
    expect(check('0.3', m('1/4'), ncal)).toBe('incorrect');
    expect(check('2 root 3', m('2sqrt(2)'), ncal)).toBe('incorrect');
  });
});

describe('shortened answers for muscle and tissue', () => {
  const cardiac = spec({ answer: 'cardiac muscle' });
  it('accepts the distinctive word alone', () => {
    expect(check('cardiac', cardiac, ncal)).toBe('correct');
    expect(check('connective', spec({ answer: 'connective tissue' }), ncal)).toBe('correct');
  });
  it('does not accept just the generic noun', () => {
    expect(check('muscle', cardiac, ncal)).toBe('incorrect');
  });
});
