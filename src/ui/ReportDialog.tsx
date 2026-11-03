import { useState } from 'react';
import { REPORT_REASON_LABEL, reportReasons, type ReportReason } from '../core/types';
import { useApp } from './context';

interface Props {
  questionId: string;
  onClose: () => void;
}

/** "Report a problem" dialog available on every question. */
export function ReportDialog({ questionId, onClose }: Props) {
  const { repo } = useApp();
  const [reason, setReason] = useState<ReportReason>('wrong_answer');
  const [note, setNote] = useState('');
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const send = async () => {
    setState('sending');
    try {
      await repo.createReport({
        question_id: questionId,
        reason,
        typed_answer: reason === 'my_answer_should_count' && typed.trim() ? typed.trim().slice(0, 200) : undefined,
        note: note.trim() ? note.trim().slice(0, 500) : undefined,
      });
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Report a problem">
      <div className="modal stack" style={{ maxWidth: 480 }}>
        <h2>Report a problem</h2>
        {state === 'sent' ? (
          <>
            <div className="notice ok">Thanks — your report was sent.</div>
            <button className="primary" autoFocus onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <label className="field">
              <span className="lbl">What is wrong?</span>
              <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} autoFocus>
                {reportReasons.map((r) => <option key={r} value={r}>{REPORT_REASON_LABEL[r]}</option>)}
              </select>
            </label>
            {reason === 'my_answer_should_count' && (
              <label className="field">
                <span className="lbl">What did you type?</span>
                <input type="text" maxLength={200} value={typed} onChange={(e) => setTyped(e.target.value)} />
              </label>
            )}
            <label className="field">
              <span className="lbl">Note (optional)</span>
              <textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {state === 'error' && <div className="notice error">Could not send the report. Try again later.</div>}
            <div className="row">
              <button className="primary" disabled={state === 'sending'} onClick={send}>Send report</button>
              <button onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
