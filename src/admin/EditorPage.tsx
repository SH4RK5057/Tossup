import { useEffect, useState } from 'react';
import type { Question } from '../core/types';
import { useApp } from '../ui/context';
import { QuestionEditor } from './QuestionEditor';

export function EditorPage({ id }: { id: string }) {
  const { repo } = useApp();
  const [q, setQ] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    repo.getQuestion(id).then((r) => (r ? setQ(r) : setError('Question not found')), (e) => setError(String(e)));
  }, [repo, id]);
  return (
    <div className="stack">
      <a href="#/admin">← All questions</a>
      {error && <div className="notice error">{error}</div>}
      {q && <div className="panel"><QuestionEditor question={q} onSaved={setQ} /></div>}
    </div>
  );
}
