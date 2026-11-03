import { useEffect, useState } from 'react';
import type { Question } from '../core/types';
import { useApp } from '../ui/context';
import { QuestionEditor } from './QuestionEditor';

/** Editor opened from the Edit button during practice. Timers hold while it is open. */
export default function EditorModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { repo } = useApp();
  const [q, setQ] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    repo.getQuestion(id).then((r) => (r ? setQ(r) : setError('Question not found')), (e) => setError(String(e)));
  }, [repo, id]);
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Edit question">
      <div className="modal">
        {error && <div className="notice error">{error}</div>}
        {!q && !error && <p className="muted">Loading…</p>}
        {q && <QuestionEditor question={q} onSaved={setQ} onCancel={onClose} />}
        {error && <div className="row" style={{ marginTop: '1rem' }}><button onClick={onClose}>Close</button></div>}
      </div>
    </div>
  );
}
