import { describe, expect, it } from 'vitest';
import seed from '../../seed/questions.json';
import { questionSchema } from '../core/types';
import { coldAnswerPrompt, generatePrompt } from './promptTemplates';

const qs = (seed as unknown[]).map((q) => questionSchema.parse(q));

describe('prompt templates', () => {
  it('builds ruleset-specific question prompts', () => {
    const n = generatePrompt({ rulesetId: 'ncal', level: 'jv', type: 'tossup', category: 'Math', subcategory: 'Algebra 2', count: 5 });
    expect(n).toContain('Write 5 tossup questions');
    expect(n).toContain('speedcheck');
    expect(n).toContain('"subcategory": "Algebra 2"');
    const q = generatePrompt({ rulesetId: 'quizbowl', level: 'varsity', type: 'bonus', category: 'Science', subcategory: 'Physics', count: 1 });
    expect(q).toContain('exactly 3 parts');
    expect(q).toContain('"leadin"');
  });
  it('never leaks answer keys into the cold-answer prompt', () => {
    const sample = qs.slice(0, 12).map((q) => ({ ...q, status: 'pending' as const }));
    const prompt = coldAnswerPrompt(sample);
    for (const q of sample) {
      expect(prompt).toContain(q.id);
      const keys = q.type === 'tossup' ? [q.answer] : q.parts.map((p) => p.answer);
      for (const k of keys) expect(prompt).not.toContain(`"${k}"`);
    }
  });
});
