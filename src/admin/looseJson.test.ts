import { describe, expect, it } from 'vitest';
import { parseLooseJson } from './importLogic';

describe('loose JSON parsing', () => {
  it('accepts curly quotes, mixed quotes and code fences', () => {
    const curly = '[\n{\u201Cid\u201D:\u201Da-1\u201D,\u201Danswer\u201D:\u201DMohs scale\u201D},\n{\u201Cid\u201D:\u201Da-2",\u201Danswer\u201D:\u201D9"},\n{\u201Cid\u201D:\u201Da-3\u201D,\u201Danswer\u201D:[\u201Cx\u201D,\u201DCharlotte\u2019s Web\u201D]}\n]';
    expect(parseLooseJson(curly).value).toEqual([
      { id: 'a-1', answer: 'Mohs scale' },
      { id: 'a-2', answer: '9' },
      { id: 'a-3', answer: ['x', 'Charlotte\u2019s Web'] },
    ]);
    expect(parseLooseJson('```json\n[{"id":"a","answer":"b"}]\n```').value).toEqual([{ id: 'a', answer: 'b' }]);
  });

  it('still parses ordinary JSON and reports genuinely broken JSON', () => {
    expect(parseLooseJson('[{"id":"a","answer":"b"}]').value).toEqual([{ id: 'a', answer: 'b' }]);
    expect(parseLooseJson('[{"id": }').error).toBeTruthy();
  });
});
