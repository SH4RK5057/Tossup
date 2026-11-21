import { describe, expect, it } from 'vitest';
import { balanceBySubject } from './pool';

const item = (category: string, subcategory: string, n: number) => ({ category, subcategory, n });

describe('balanceBySubject', () => {
  const pool = [
    ...Array.from({ length: 60 }, (_, i) => item('Fine Arts', 'Music', i)),
    ...Array.from({ length: 10 }, (_, i) => item('Fine Arts', 'Art', i)),
    ...Array.from({ length: 10 }, (_, i) => item('Math', 'Algebra', i)),
    ...Array.from({ length: 10 }, (_, i) => item('Science', 'Biology', i)),
  ];
  it('keeps every item', () => {
    expect(balanceBySubject(pool)).toHaveLength(pool.length);
  });
  it('draws categories, then subjects, evenly instead of by pool size', () => {
    const first = balanceBySubject(pool).slice(0, 30);
    const count = (s: string) => first.filter((x) => x.subcategory === s).length;
    // 3 categories: Math and Science get 10 each; Fine Arts splits 10 between Music and Art.
    expect(count('Algebra')).toBe(10);
    expect(count('Biology')).toBe(10);
    expect(count('Music')).toBe(5);
    expect(count('Art')).toBe(5);
  });
  it('keeps going when a subject runs out', () => {
    const all = balanceBySubject(pool);
    expect(all.filter((x) => x.subcategory === 'Music')).toHaveLength(60);
  });
  it('handles an empty list', () => {
    expect(balanceBySubject([])).toEqual([]);
  });
});

describe('balanceBySubject with a tiny category', () => {
  it('keeps a one-question category out of the front of the rotation', () => {
    const pool = [
      ...Array.from({ length: 40 }, (_, i) => item('Science', 'Biology', i)),
      ...Array.from({ length: 40 }, (_, i) => item('Math', 'Algebra', i)),
      item('Current Events', 'Current Events', 0),
    ];
    const out = balanceBySubject(pool);
    expect(out).toHaveLength(81);
    expect(out.slice(0, 80).some((x) => x.category === 'Current Events')).toBe(false);
    expect(out[80].category).toBe('Current Events');
  });
});
