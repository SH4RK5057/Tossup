import { useEffect, useRef, useState } from 'react';
import {
  activeClockSeconds, bonusIsTogether, currentBonus, currentTossup, lastBonusRecord, lastTossupRecord,
  questionNumber, questionTotal, type Action, type BonusPartRecord, type SessionState,
} from '../core/session';
import { LEVEL_LABEL, type AnswerSpec } from '../core/types';
import { useApp } from './context';
import { formatClock } from './format';
import { ReportDialog } from './ReportDialog';

interface Props {
  session: SessionState;
  dispatch: (a: Action) => void;
  onDone: () => void;
  onQuit: () => void;
  onEdit: (id: string) => void;
  /** True while a modal (e.g. the editor) is open: timers hold. */
  paused: boolean;
}

function AnswerBox({ onSubmit, onTyped, placeholder }: { onSubmit: (v: string) => void; onTyped: (v: string) => void; placeholder?: string }) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <form className="answer-row" onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}>
      <input ref={ref} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="Your answer"
        placeholder={placeholder ?? 'Type your answer'} value={value}
        onChange={(e) => { setValue(e.target.value); onTyped(e.target.value); }} />
      <button className="primary" type="submit">Submit</button>
    </form>
  );
}

function BonusInputs({ parts, onSubmit, onTyped }: { parts: { text: string; part_difficulty: string }[]; onSubmit: (v: string[]) => void; onTyped: (v: string[]) => void }) {
  const [values, setValues] = useState<string[]>(() => parts.map(() => ''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const update = (i: number, v: string) => {
    const next = values.map((x, j) => (j === i ? v : x));
    setValues(next);
    onTyped(next);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(values); }}>
      {parts.map((p, i) => (
        <div className="part" key={i}>
          <div className="ptext">{i + 1}. {p.text}</div>
          <input ref={(el) => { refs.current[i] = el; }} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false}
            aria-label={`Answer to part ${i + 1}`} value={values[i]}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && i < parts.length - 1) { e.preventDefault(); refs.current[i + 1]?.focus(); }
            }} />
        </div>
      ))}
      <div className="toolbar">
        <button className="primary" type="submit">Submit all parts</button>
        <span className="hint">Enter moves to the next part; Enter on the last part submits.</span>
      </div>
    </form>
  );
}

function AnswerKey({ spec }: { spec: AnswerSpec }) {
  const extras = [...(spec.required && spec.required !== spec.answer ? [`min: ${spec.required}`] : []), ...spec.alternates];
  return (
    <div className="answer-key">
      <strong>{spec.answer}</strong>
      {extras.length > 0 && <span className="muted small"> &nbsp;(also: {extras.join('; ')})</span>}
    </div>
  );
}

export function Play({ session: s, dispatch, onDone, onQuit, onEdit, paused }: Props) {
  const { isAdmin, repo } = useApp();
  const tossup = currentTossup(s);
  const bonus = currentBonus(s);
  const inBonus = s.phase === 'bonus_intro' || s.phase === 'bonus' || s.phase === 'bonus_part_result' || s.phase === 'bonus_result';
  const typedRef = useRef('');
  const partsRef = useRef<string[]>([]);
  const phaseAt = useRef(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const remainingMs = useRef<number | null>(null);
  const [gameRemaining, setGameRemaining] = useState<number | null>(s.gameClockSeconds);
  const [flash, setFlash] = useState<'correct' | 'incorrect' | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [overrideSaved, setOverrideSaved] = useState<Set<string>>(new Set());

  const clockSeconds = activeClockSeconds(s);

  // Reset the answer clock whenever a new question / prompt / part begins.
  useEffect(() => {
    typedRef.current = '';
    partsRef.current = [];
    phaseAt.current = performance.now();
    remainingMs.current = clockSeconds === null ? null : clockSeconds * 1000;
    setRemaining(clockSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.clockKey, s.phase]);

  // Answer timer. The UI owns the timer; the engine only receives a timeout action.
  useEffect(() => {
    if (clockSeconds === null || paused || remainingMs.current === null) return;
    const started = performance.now();
    const base = remainingMs.current;
    const id = window.setInterval(() => {
      const left = base - (performance.now() - started);
      remainingMs.current = left;
      setRemaining(Math.max(0, left / 1000));
      if (left <= 0) {
        window.clearInterval(id);
        dispatch({ type: 'timeout', answer: typedRef.current, answers: partsRef.current });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [s.clockKey, s.phase, clockSeconds, paused, dispatch]);

  // Game clock for the match simulation.
  const gameStart = useRef(performance.now());
  useEffect(() => {
    if (s.gameClockSeconds === null) return;
    const id = window.setInterval(() => {
      const left = s.gameClockSeconds! - (performance.now() - gameStart.current) / 1000;
      setGameRemaining(Math.max(0, left));
      if (left <= 0) { window.clearInterval(id); dispatch({ type: 'clockExpired' }); }
    }, 250);
    return () => window.clearInterval(id);
  }, [s.gameClockSeconds, dispatch]);

  // Light flash on submit, like a buzzer system's lockout light.
  const resultCount = s.records.length;
  const lastWasCorrect = (() => {
    const r = s.records[s.records.length - 1];
    return r ? (r.kind === 'tossup' ? r.correct : r.points > 0) : false;
  })();
  useEffect(() => {
    if (resultCount === 0) return;
    setFlash(lastWasCorrect ? 'correct' : 'incorrect');
    const id = window.setTimeout(() => setFlash(null), 650);
    return () => window.clearTimeout(id);
  }, [resultCount, lastWasCorrect]);

  useEffect(() => { if (s.phase === 'done') onDone(); }, [s.phase, onDone]);

  // Keyboard: Enter (or N) advances from result screens and starts a bonus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || reporting) return;
      if (e.repeat || performance.now() - phaseAt.current < 300) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key !== 'Enter' && e.key.toLowerCase() !== 'n') return;
      if (tag === 'BUTTON' && e.key === 'Enter') return; // the focused button handles Enter itself
      if (s.phase === 'bonus_intro') { e.preventDefault(); dispatch({ type: 'startBonus' }); }
      else if (s.phase === 'tossup_result' || s.phase === 'bonus_part_result' || s.phase === 'bonus_result') {
        e.preventDefault();
        dispatch({ type: 'next' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.phase, paused, reporting, dispatch]);

  // Return focus to the primary action on result screens so Enter keeps working.
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (s.phase === 'tossup_result' || s.phase === 'bonus_part_result' || s.phase === 'bonus_result' || s.phase === 'bonus_intro') {
      nextRef.current?.focus({ preventScroll: true });
    }
  }, [s.phase, s.clockKey]);

  const logOverride = async (questionId: string, typed: string, key: string) => {
    try { await repo.createReport({ question_id: questionId, reason: 'my_answer_should_count', typed_answer: typed.slice(0, 200) }); } catch { /* best effort */ }
    setOverrideSaved((prev) => new Set(prev).add(key));
  };

  const questionId = inBonus ? bonus?.id : tossup?.id;
  const timerLow = remaining !== null && remaining <= 3 && (s.phase === 'tossup' || s.phase === 'tossup_prompt' || s.phase === 'bonus');
  const liveClockPhase = s.phase === 'tossup' || s.phase === 'tossup_prompt' || s.phase === 'bonus';
  const cells = [
    { label: 'Score', value: String(s.score) },
    { label: s.kind === 'bonus' ? 'Bonus' : 'Question', value: `${questionNumber(s)}${s.kind === 'sim' && s.gameClockSeconds === null ? `/${questionTotal(s)}` : ''}` },
    { label: 'Time', value: !liveClockPhase ? '–' : clockSeconds === null ? '∞' : remaining === null ? '–' : formatClock(remaining), low: timerLow },
    ...(s.gameClockSeconds !== null ? [{ label: 'Game clock', value: formatClock(gameRemaining ?? 0) }] : []),
  ];

  const q = inBonus ? bonus : tossup;
  const meta = q ? `${q.category} · ${q.subcategory} · ${LEVEL_LABEL[q.level]}` : '';

  const tRec = lastTossupRecord(s);
  const bRec = lastBonusRecord(s);

  const partResult = (p: BonusPartRecord, i: number, spec: AnswerSpec, canOverride: boolean) => (
    <div className="part" key={i}>
      <div><span className={`verdict ${p.correct ? 'correct' : 'incorrect'}`} style={{ fontSize: '1.05rem' }}>
        {i + 1}. {p.correct ? 'Correct' : p.timedOut ? "Time's up" : 'Incorrect'}{p.overridden ? ' (marked right)' : ''}
        {p.points ? ` +${p.points}` : ''}
      </span></div>
      {p.typed && <div className="muted small">You typed: {p.typed}</div>}
      <AnswerKey spec={spec} />
      {!p.correct && canOverride && bonus && (
        <button className="link" onClick={() => {
          dispatch({ type: 'override', part: i });
          void logOverride(bonus.id, p.typed, `${bonus.id}:${i}`);
        }}>I was right</button>
      )}
    </div>
  );

  return (
    <div className={`play${flash ? ` flash-${flash}` : ''}`}>
      <div className="scoreboard" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
        {cells.map((c) => (
          <div className="cell" key={c.label}><small>{c.label}</small><b className={c.low ? 'low' : ''}>{c.value}</b></div>
        ))}
      </div>

      <div className="play-body">
        <div className="card">
          <div className="meta">{meta}</div>

          {(s.phase === 'tossup' || s.phase === 'tossup_prompt') && tossup && (
            <>
              <div className="qtext">{tossup.text}</div>
              {s.phase === 'tossup_prompt' && <div className="prompt-note">More specific?</div>}
              <AnswerBox key={s.clockKey} onTyped={(v) => { typedRef.current = v; }}
                onSubmit={(v) => dispatch({ type: 'submitAnswer', answer: v })} />
            </>
          )}

          {s.phase === 'tossup_result' && tossup && tRec && (
            <>
              <div className="qtext">{tossup.text}</div>
              <div className={`verdict ${tRec.correct ? 'correct' : 'incorrect'}`}>
                {tRec.correct ? 'Correct' : tRec.timedOut ? "Time's up" : 'Incorrect'}{tRec.overridden ? ' (marked right)' : ''}
                {tRec.points ? ` ${tRec.points > 0 ? '+' : ''}${tRec.points}` : ''}
              </div>
              {tRec.typed && <div className="muted small">You typed: {tRec.typed}</div>}
              <AnswerKey spec={tossup} />
              <div className="toolbar">
                <button className="primary" ref={nextRef} onClick={() => dispatch({ type: 'next' })}>Next <kbd>Enter</kbd></button>
                {!tRec.correct && (
                  <button onClick={() => {
                    dispatch({ type: 'override' });
                    void logOverride(tossup.id, tRec.typed, tossup.id);
                  }}>I was right</button>
                )}
              </div>
            </>
          )}

          {s.phase === 'bonus_intro' && bonus && (
            <>
              <div className="leadin">{bonus.leadin}</div>
              <p className="muted">
                {bonusIsTogether(s)
                  ? `${bonus.parts.length} parts, shown together${s.settings.bonusSeconds === null ? '' : ` — ${s.settings.bonusSeconds} seconds in all`}.`
                  : `${bonus.parts.length} parts, one at a time${s.settings.bonusSeconds === null ? '' : ` — ${s.settings.bonusSeconds} seconds each`}.`}
              </p>
              <div className="toolbar">
                <button className="primary" ref={nextRef} onClick={() => dispatch({ type: 'startBonus' })}>Start bonus <kbd>Enter</kbd></button>
              </div>
            </>
          )}

          {s.phase === 'bonus' && bonus && (
            <>
              <div className="leadin">{bonus.leadin}</div>
              {bonusIsTogether(s) ? (
                <BonusInputs key={s.clockKey} parts={bonus.parts}
                  onTyped={(v) => { partsRef.current = v; }}
                  onSubmit={(v) => dispatch({ type: 'submitBonus', answers: v })} />
              ) : (
                <>
                  <div className="part">
                    <div className="ptext">Part {s.partIndex + 1} of {bonus.parts.length}: {bonus.parts[s.partIndex].text}</div>
                  </div>
                  <AnswerBox key={s.clockKey} onTyped={(v) => { typedRef.current = v; }}
                    onSubmit={(v) => dispatch({ type: 'submitAnswer', answer: v })} />
                </>
              )}
            </>
          )}

          {s.phase === 'bonus_part_result' && bonus && (() => {
            const i = s.currentBonusParts.length - 1;
            const p = s.currentBonusParts[i];
            return (
              <>
                <div className="leadin">{bonus.leadin}</div>
                <div className="part"><div className="ptext">Part {i + 1}: {bonus.parts[i].text}</div></div>
                {partResult(p, i, bonus.parts[i], true)}
                <div className="toolbar">
                  <button className="primary" ref={nextRef} onClick={() => dispatch({ type: 'next' })}>Next part <kbd>Enter</kbd></button>
                </div>
              </>
            );
          })()}

          {s.phase === 'bonus_result' && bonus && bRec && (
            <>
              <div className="leadin">{bonus.leadin}</div>
              {bonus.parts.map((part, i) => (
                <div key={i}>
                  <div className="part"><div className="ptext">{i + 1}. {part.text}<span className="badge">{part.part_difficulty}</span></div></div>
                  {partResult(bRec.parts[i], i, part, true)}
                </div>
              ))}
              <div className="verdict">Bonus total: {bRec.points}</div>
              <div className="toolbar">
                <button className="primary" ref={nextRef} onClick={() => dispatch({ type: 'next' })}>Next <kbd>Enter</kbd></button>
              </div>
            </>
          )}

          {overrideSaved.size > 0 && <p className="hint">Your “I was right” was logged for review.</p>}
        </div>

        <div className="toolbar">
          {questionId && <button className="link" onClick={() => setReporting(questionId)}>Report a problem</button>}
          {isAdmin && questionId && <button onClick={() => onEdit(questionId)}>Edit</button>}
          <span className="spacer" />
          <button className="link" onClick={() => (confirm('End this session?') ? onQuit() : undefined)}>End session</button>
        </div>
        {(s.phase === 'tossup' || s.phase === 'bonus') && <p className="hint"><kbd>Enter</kbd> submits. The clock runs out → whatever is typed is submitted.</p>}
      </div>

      {reporting && <ReportDialog questionId={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
}
