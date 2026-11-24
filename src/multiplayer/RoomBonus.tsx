// The bonus screen of a room. The bonus is read out word by word; once it is fully read, everyone on a team that is
// answering can type into any answer box (teammates see each other's typing), and only the team captain can submit.

import { useCallback, useEffect, useRef, useState } from 'react';
import { bonusWordsShown, type RoomState } from '../core/room';
import type { Bonus } from '../core/types';
import { draftKey, sendBonusSubmit, sendDraft, type RoomPlayer } from './host';
import { revealedBonus, teamLabel } from './questions';
import { roomPath, type RoomStore } from './store';

interface Props {
  store: RoomStore;
  code: string;
  state: RoomState;
  bonus: Bonus | undefined;
  players: Record<string, RoomPlayer>;
  teamMode: 'teams' | 'ffa';
  now: number;
  isHost: boolean;
  /** Label for the host's button on the result screen. */
  nextLabel: string;
  onNext: () => void;
}

interface Draft { text?: string; at?: number }

export function BonusPanel({ store, code, state, bonus, players, teamMode, now, isHost, nextLabel, onNext }: Props) {
  const round = state.bonus;
  const myTeam = state.teamOf[store.uid];
  const answering = !!round && myTeam !== undefined && round.teams.includes(myTeam);
  const captainUid = myTeam !== undefined ? state.captains[myTeam] : undefined;
  const isCaptain = captainUid === store.uid;
  const submitted = !!round && myTeam !== undefined && round.submitted.includes(myTeam);
  const result = state.phase === 'bonus_result';
  const nameOf = (uid: string) => players[uid]?.name ?? 'Someone';
  const teamName = (t: string) => (teamMode === 'teams' ? teamLabel(t) : nameOf(t));

  const partCount = round?.partCount ?? 0;
  const [texts, setTexts] = useState<string[]>(() => Array(partCount).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const q = state.q;

  // A new bonus starts with empty boxes.
  useEffect(() => { setTexts(Array(partCount).fill('')); }, [q, round?.index, partCount]);

  // Teammates' typing shows up here (the newest draft of each part wins), unless I am typing in that box myself.
  useEffect(() => {
    if (!answering || !round || myTeam === undefined || result) return;
    const offs: (() => void)[] = [];
    for (let i = 0; i < round.partCount; i++) {
      offs.push(store.onValue(roomPath(code, 'answer', draftKey(q, myTeam, i)), (v) => {
        const entries = Object.entries((v as Record<string, Draft> | null) ?? {}).filter(([, d]) => typeof d?.text === 'string');
        const latest = entries.sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0))[0];
        if (!latest || latest[0] === store.uid) return;
        if (document.activeElement === inputs.current[i]) return;
        setTexts((cur) => (cur[i] === latest[1].text ? cur : cur.map((t, j) => (j === i ? (latest[1].text as string) : t))));
      }));
    }
    return () => offs.forEach((o) => o());
  }, [answering, round?.index, myTeam, q, code, store, result, round?.partCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const change = (i: number, text: string) => {
    setTexts((cur) => cur.map((t, j) => (j === i ? text : t)));
    if (myTeam === undefined) return;
    clearTimeout(timers.current[i]);
    timers.current[i] = setTimeout(() => { void sendDraft(store, code, q, myTeam, i, text); }, 250);
  };

  const submit = useCallback(() => {
    if (!isCaptain || myTeam === undefined || submitted) return;
    Object.values(timers.current).forEach(clearTimeout);
    void sendBonusSubmit(store, code, q, myTeam, texts);
  }, [isCaptain, myTeam, submitted, store, code, q, texts]);

  if (!round || !bonus) return <section className="panel"><p className="muted">Loading the bonus…</p></section>;

  const shown = bonusWordsShown(state, now);
  const rev = revealedBonus(bonus, shown);
  const reading = !round.open && !result;
  const remainingMs = (round.answerDeadline ?? now) - now;

  return (
    <section className="panel stack">
      <div className="muted small">
        Bonus for {round.teams.map(teamName).join(' and ')}{teamMode === 'teams' && round.teams.length === 1 ? '' : ''}
        {!answering && myTeam !== undefined ? ' · you are watching this one' : ''}
      </div>
      <div className="room-question" aria-live="polite">
        <strong>{rev.leadin}</strong>
        {reading && shown < round.wordCount && <span className="room-cursor">▌</span>}
      </div>
      <ol className="room-bonus-parts">
        {bonus.parts.map((p, i) => (
          <li key={i} style={{ margin: '0.6rem 0' }}>
            <div>{rev.parts[i] || (reading ? '' : p.text)}</div>
            {!result && round.open && answering && (
              <input ref={(el) => { inputs.current[i] = el; }} type="text" value={texts[i] ?? ''} disabled={submitted}
                placeholder={`Answer ${i + 1}`} style={{ width: '100%', marginTop: 4 }}
                onChange={(e) => change(i, e.target.value)} />
            )}
            {result && (
              <div className="small" style={{ marginTop: 2 }}>
                Answer: <strong>{p.answer}</strong>
                {round.teams.map((t) => {
                  const r = round.results[t];
                  const ok = r?.verdicts[i];
                  return (
                    <div key={t}>
                      <span style={{ color: ok ? 'var(--ok, #4ade80)' : 'var(--bad, #f87171)', fontWeight: 600 }}>{ok ? '✓' : '✗'}</span>{' '}
                      {teamName(t)}: <em>{r?.answers[i]?.trim() ? r.answers[i] : '(blank)'}</em>
                    </div>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ol>

      {reading && <p className="muted small">Listen to the whole bonus first; you can type once it has been read.</p>}
      {!result && round.open && answering && (
        <div className="stack">
          <div className="row">
            {isCaptain
              ? <button className="primary" disabled={submitted} onClick={submit}>{submitted ? 'Submitted' : 'Submit all answers'}</button>
              : <span className="muted">{submitted ? 'Your captain submitted the team answers.' : `Anyone on your team can type. Only ${nameOf(captainUid ?? '')} (captain) can submit.`}</span>}
            <span className="room-clock">{Math.max(0, Math.ceil(remainingMs / 1000))}s</span>
          </div>
          {isCaptain && !submitted && <p className="hint">You are your team's captain. Teammates' typing appears in the boxes; press Submit when you are all done, or the clock will submit what is typed.</p>}
        </div>
      )}
      {!result && round.open && !answering && (
        <div className="notice">{round.teams.map(teamName).join(' and ')} {round.teams.length === 1 ? 'is' : 'are'} answering… <span className="muted">{Math.max(0, Math.ceil(remainingMs / 1000))}s</span></div>
      )}
      {!result && round.open && round.submitted.length > 0 && (
        <p className="muted small">Submitted so far: {round.submitted.map(teamName).join(', ')}.</p>
      )}

      {result && (
        <div className="stack">
          <div className="notice">
            {round.teams.map((t) => `${teamName(t)}: ${round.results[t]?.verdicts.filter(Boolean).length ?? 0} of ${round.partCount} right (+${round.results[t]?.points ?? 0})`).join(' · ')}
          </div>
          {isHost
            ? <div><button className="primary" autoFocus onClick={onNext}>{nextLabel}</button></div>
            : <p className="muted">Waiting for the host…</p>}
        </div>
      )}
    </section>
  );
}
