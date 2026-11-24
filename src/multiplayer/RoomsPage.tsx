// The room view: lobby, buzz-in play, scoreboard. Hosting and joining happen on the Practice screen (Room mode),
// which shares its settings with solo practice.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { levelsForPool } from '../core/pool';
import { normalizeRoomState, rankTeams, segmentOf, wordsShown, type PlayerScore, type RoomMode, type RoomState } from '../core/room';
import { getRuleset } from '../core/rulesets';
import { LEVEL_LABEL, type Bonus, type Tossup } from '../core/types';
import { navigate, useApp } from '../ui/context';
import { connect, type Connection } from './connect';
import { RoomHost, sendAnswer, sendBuzz, writePlayer, type RoomPlayer } from './host';
import {
  buildRoomBonuses, buildRoomQuestions, normalizeSettings, poolSignature, revealedText, TEAM_IDS, teamLabel, toHostBonuses, toHostQuestions,
} from './questions';
import { LobbySettings, SettingsSummary } from './LobbySettings';
import { BonusPanel } from './RoomBonus';
import { joinAsPlayer, savedName, saveName, setActiveRoom, type Meta } from './roomOps';
import { roomPath, type RoomStore } from './store';

/** How long a result is held on screen before the host's Next button works. */
const RESULT_HOLD_MS = 1500;

/** False for `ms` after `key` changes, then true. */
function useHold(key: string, ms: number): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return ready;
}

/** The answer to a tossup as a full-width panel, so the winning answer is hard to miss. */
function AnswerReveal({ kind, title, answer, typed, note }: { kind: 'correct' | 'miss'; title: string; answer: string; typed?: string; note?: string }) {
  const showTyped = typed !== undefined && typed.trim() !== '' && typed.trim().toLowerCase() !== answer.trim().toLowerCase();
  return (
    <div className={`room-reveal ${kind}`} role="status" aria-live="polite">
      <div className="room-reveal-title">{kind === 'correct' ? '✓ ' : ''}{title}</div>
      <div className="room-reveal-label">Answer</div>
      <div className="room-reveal-answer">{answer}</div>
      {showTyped && <div className="room-reveal-typed">They typed: “{typed}”</div>}
      {note && <div className="room-reveal-note">{note}</div>}
    </div>
  );
}

/** Subscribes to a path; undefined while the first value is loading. */
function useValue<T>(store: RoomStore | null, path: string | null): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    setValue(undefined);
    if (!store || !path) return;
    return store.onValue(path, (v) => setValue(v as T | null));
  }, [store, path]);
  return value;
}

export default function RoomsPage({ code }: { code: string }) {
  const [conn, setConn] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    connect(false).then(setConn, (e) => setError(String(e)));
  }, []);
  const [name, setName] = useState(savedName);

  if (error) return <div className="page"><div className="notice error">{error}</div></div>;
  if (!conn) return <div className="page muted">Connecting…</div>;

  const leave = () => {
    setActiveRoom(null);
    navigate('/rooms');
  };

  return (
    <div className="page stack">
      <h1>Room</h1>
      {conn.note && <div className="notice">{conn.note}</div>}
      <RoomView store={conn.store} code={code} onLeave={leave} name={name} setName={(n) => { setName(n); saveName(n); }} />
    </div>
  );
}

// ------------------------------------------------------------------ inside a room

/** Shown to someone who opened a room link without being in the room yet: a name is required to join. */
function JoinPrompt({ store, code, meta, name, setName }: { store: RoomStore; code: string; meta: Meta; name: string; setName: (n: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const join = async () => {
    if (!trimmed) { setError('Type your name to join.'); return; }
    setBusy(true);
    setError(null);
    try {
      const problem = await joinAsPlayer(store, code, meta, trimmed);
      if (problem) setError(problem);
    } catch (e) {
      setError(`Could not join: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel stack">
      <h2>Join room {code}</h2>
      {error && <div className="notice error">{error}</div>}
      <label className="field">
        <span className="lbl">Your name</span>
        <input autoFocus type="text" value={name} maxLength={20} placeholder="Name shown to the room"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void join(); }} />
      </label>
      <div><button className="primary" disabled={busy || !trimmed} onClick={join}>Join room</button></div>
    </section>
  );
}

const MODE_LABEL: Record<RoomMode, string> = { tossup: 'Tossups', bonus: 'Bonus drill', sim: 'Game sim' };

/** The game's questions, built from the host's seed; everyone builds the same lists. */
interface Content { seed: string; tossups: Tossup[]; bonuses: Bonus[] }

function RoomView({ store, code, onLeave, name, setName }: { store: RoomStore; code: string; onLeave: () => void; name: string; setName: (n: string) => void }) {
  const { repo } = useApp();
  const rawMeta = useValue<Meta>(store, roomPath(code, 'meta'));
  const meta = useMemo<Meta | null | undefined>(
    () => (rawMeta ? { ...rawMeta, settings: normalizeSettings(rawMeta.settings as never) } : rawMeta),
    [rawMeta],
  );
  const players = useValue<Record<string, RoomPlayer>>(store, roomPath(code, 'players'));
  const stored = useValue<RoomState>(store, roomPath(code, 'state'));
  const state = useMemo(() => normalizeRoomState(stored), [stored]);
  const isHost = !!meta && meta.hostUid === store.uid;

  // Everyone builds the same question lists from the host's seed (the host reseeds before every game).
  const [content, setContent] = useState<Content | null>(null);
  const [sigOk, setSigOk] = useState(true);
  useEffect(() => {
    if (!meta) return;
    const s = meta.settings;
    let live = true;
    const rs = getRuleset(s.rulesetId);
    repo.loadPool({ rulesetId: s.rulesetId, level: s.level, levels: levelsForPool(rs, s.level) }).then((pool) => {
      if (!live) return;
      setSigOk(poolSignature(pool) === s.bankSig);
      setContent({ seed: s.seed, tossups: buildRoomQuestions(pool, s), bonuses: buildRoomBonuses(pool, s) });
    }).catch(() => { if (live) setContent({ seed: s.seed, tossups: [], bonuses: [] }); });
    return () => { live = false; };
  }, [repo, meta?.settings.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = !!meta && !!content && content.seed === meta.settings.seed;

  // The host's screen runs the referee. It is created once and handed new questions before each game.
  const hostRef = useRef<RoomHost | null>(null);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  useEffect(() => () => { hostRef.current?.dispose(); hostRef.current = null; }, []);
  useEffect(() => {
    if (!isHost || !meta || !content || stored === undefined || content.seed !== meta.settings.seed) return;
    const s = meta.settings;
    const rs = getRuleset(s.rulesetId);
    const hc = { tossups: toHostQuestions(content.tossups, s.rulesetId, s), bonuses: toHostBonuses(content.bonuses, s.rulesetId, s) };
    if (!hostRef.current) {
      hostRef.current = new RoomHost({
        store, code, mode: s.mode, teamMode: s.teamMode, wordsPerSecond: s.wordsPerSecond,
        scoring: { correct: rs.tossupValue, wrong: rs.wrongTossupPoints, bonusPart: rs.bonus.pointsPerPart },
        ...hc, initialState: stored ? normalizeRoomState(stored) : null,
      });
    } else {
      hostRef.current.setContent(hc, s.mode);
      hostRef.current.setConfig({
        teamMode: s.teamMode, wordsPerSecond: s.wordsPerSecond,
        scoring: { correct: rs.tossupValue, wrong: rs.wrongTossupPoints, bonusPart: rs.bonus.pointsPerPart },
      });
    }
    if (pendingStart && pendingStart === s.seed) { setPendingStart(null); hostRef.current.start(); }
  }, [isHost, meta?.settings.seed, content, stored === undefined, pendingStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw ten times a second so the reveal and the clocks run smoothly.
  const [, force] = useState(0);
  useEffect(() => { const id = setInterval(() => force((n) => n + 1), 100); return () => clearInterval(id); }, []);

  // A result stays on screen for a moment before the host can move on, so the answer is never skipped past by
  // an Enter press (or a held key) that was still going when the result appeared.
  const nextReady = useHold(`${state.q}:${state.phase}:${state.bonusesUsed}`, RESULT_HOLD_MS);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (nextReady && isHost && (state.phase === 'result' || state.phase === 'bonus_result')) nextRef.current?.focus();
  }, [nextReady, isHost, state.phase]);

  if (meta === undefined || players === undefined || stored === undefined) return <p className="muted">Joining room {code}…</p>;
  if (meta === null) {
    return <div className="notice row"><span>Room {code} is closed or does not exist.</span><button onClick={onLeave}>Back</button></div>;
  }

  const me = players?.[store.uid];
  const playerList = Object.entries(players ?? {}).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
  const nameOf = (uid: string) => players?.[uid]?.name ?? 'Someone';
  const teamOfUid = (uid: string) => (meta.settings.teamMode === 'teams' ? (players?.[uid]?.team ?? uid) : uid);
  const teamName = (t: string) => (meta.settings.teamMode === 'teams' ? teamLabel(t) : nameOf(t));
  const settings = meta.settings;

  const closeRoom = async () => { await store.remove(roomPath(code)); onLeave(); };
  const leaveRoom = async () => {
    if (state.phase === 'lobby') await store.remove(roomPath(code, 'players', store.uid));
    onLeave();
  };
  const changeTeam = (team: string) => { if (me) void writePlayer(store, code, me.name, team); };
  /** Reseeds the room and starts a game with fresh questions (the host starts it once everyone has the new list). */
  const startGame = async () => {
    const seed = Math.random().toString(36).slice(2);
    await store.set(roomPath(code, 'meta', 'settings', 'seed'), seed);
    setPendingStart(seed);
  };

  const rounds = settings.mode === 'bonus' ? content?.bonuses.length : content?.tossups.length;
  const header = (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div><strong>Room {code}</strong> <span className="muted small">· {MODE_LABEL[settings.mode]} · {LEVEL_LABEL[settings.level]} · {settings.unlimited ? 'unlimited' : `${ready && rounds !== undefined ? rounds : settings.questions} ${settings.mode === 'bonus' ? 'bonuses' : 'tossups'}`} · {settings.teamMode === 'teams' ? `${settings.teamCount} teams` : 'free for all'}</span></div>
      <div className="row">
        {isHost && state.phase !== 'lobby' && (
          <button onClick={() => { if (confirm('End the game now and go back to the lobby?')) hostRef.current?.end(); }}>End game</button>
        )}
        {isHost ? <button className="danger" onClick={() => { if (confirm('Close the room for everyone?')) void closeRoom(); }}>Close room</button>
          : <button onClick={() => void leaveRoom()}>Leave</button>}
      </div>
    </div>
  );

  const hostHint = isHost ? <p className="hint">You are hosting: keep this tab open and in view, because your screen runs the clocks and scoring for everyone.</p> : null;

  if (!sigOk) {
    return <>{header}<div className="notice error">Your copy of the site has a different question bank than the host's. Reload the page (or clear the cache) and rejoin.</div></>;
  }

  // ---- lobby (also where everyone lands after a game)
  if (state.phase === 'lobby') {
    // Opened from a shared link without being in the room yet: ask for a name first.
    if (!me) return <>{header}<JoinPrompt store={store} code={code} meta={meta} name={name} setName={setName} /></>;
    const share = `${window.location.origin}${window.location.pathname}#/rooms?code=${code}`;
    const last = state.lastGame;
    return (
      <>
        {header}
        {hostHint}
        {last && (
          <section className="panel stack">
            <h2>{MODE_LABEL[last.mode]}: final scores</h2>
            {(() => {
              const winner = rankTeams(last)[0];
              return winner ? <p style={{ fontSize: '1.2rem' }}>Winner: <strong>{teamName(winner.team)}</strong> with {winner.points} points</p> : null;
            })()}
            <Scoreboard teamOf={last.teamOf} teamScores={last.teamScores} players={players ?? {}} teamMode={settings.teamMode} meUid={store.uid} teamName={teamName} />
            {last.mode !== 'bonus' && <PlayerTable teamOf={last.teamOf} playerScores={last.playerScores} players={players ?? {}} />}
          </section>
        )}
        <section className="panel stack">
          <div className="row" style={{ alignItems: 'baseline' }}>
            <span className="lbl">Share this code</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '0.3em' }}>{code}</span>
            <button className="link small" onClick={() => { void navigator.clipboard?.writeText(share); }}>Copy link</button>
          </div>
          <PlayersByTeam players={playerList} teamMode={settings.teamMode} teamCount={settings.teamCount} meUid={store.uid} onTeam={changeTeam} hostUid={meta.hostUid} />
          {isHost
            ? <div className="row">
                <button className="primary" disabled={!ready || !rounds || playerList.length === 0 || pendingStart !== null} onClick={() => void startGame()}>{last ? 'Start a new game' : 'Start game'}</button>
                {!ready && <span className="muted small">Loading questions…</span>}
                {ready && !rounds && <span className="muted small">No questions match these settings.</span>}
              </div>
            : <p className="muted">{last ? 'Waiting for the host to start the next game…' : 'Waiting for the host to start…'}</p>}
        </section>
        {isHost
          ? <LobbySettings store={store} code={code} meta={meta} players={players ?? {}} />
          : <SettingsSummary settings={settings} />}
      </>
    );
  }

  const now = store.now();
  const taking = state.teamOf[store.uid] !== undefined;
  const scoreboard = <Scoreboard teamOf={state.teamOf} teamScores={state.teamScores} players={players ?? {}} teamMode={settings.teamMode} meUid={store.uid} teamName={teamName} />;
  const isLast = state.q + 1 >= state.total;
  const countText = `${settings.mode === 'bonus' ? 'Bonus' : 'Question'} ${state.q + 1}${settings.unlimited ? '' : ` of ${state.total}`}`;

  // ---- bonus
  if (state.phase === 'bonus' || state.phase === 'bonus_result') {
    const bonus = content?.bonuses[state.bonus?.index ?? 0];
    const nextLabel = isLast ? 'Finish game' : settings.mode === 'bonus' ? 'Next bonus' : 'Next question';
    return (
      <>
        {header}
        {hostHint}
        {scoreboard}
        <div className="muted small">{countText}{taking ? '' : ' · you are watching this game'}</div>
        <BonusPanel store={store} code={code} state={state} bonus={ready ? bonus : undefined} players={players ?? {}} teamMode={settings.teamMode}
          now={now} isHost={isHost} nextLabel={nextLabel} nextReady={nextReady} nextRef={nextRef} onNext={() => hostRef.current?.next()} />
      </>
    );
  }

  // ---- tossup
  const q = ready ? content?.tossups[state.q] : undefined;
  const shown = wordsShown(state, now);
  const segment = segmentOf(state);
  const winnerTeam = state.last?.kind === 'correct' && state.last.uid ? teamOfUid(state.last.uid) : null;
  const bonusNext = settings.mode === 'sim' && winnerTeam !== null && (content?.bonuses.length ?? 0) > state.bonusesUsed;
  return (
    <>
      {header}
      {hostHint}
      {scoreboard}
      <section className="panel stack">
        <div className="muted small">{countText}{taking ? '' : ' · you are watching this game'}</div>
        <div className="room-question" aria-live="polite">
          {q ? revealedText(q.text, state.phase === 'result' ? state.wordCount : shown) : '…'}
          {state.phase === 'reading' && shown < state.wordCount && <span className="room-cursor">▌</span>}
        </div>

        {state.phase === 'reading' && (
          <ReadingControls store={store} code={code} state={state} segment={segment} taking={taking} now={now}
            lastMiss={state.last && (state.last.kind === 'wrong' || state.last.kind === 'pass') ? `${nameOf(state.last.uid ?? '')} ${state.last.kind === 'wrong' ? `missed (${state.last.points})` : 'passed'}.` : null} />
        )}
        {state.phase === 'answering' && (
          <AnsweringControls store={store} code={code} state={state} segment={segment} now={now} buzzerName={nameOf(state.buzzer ?? '')} />
        )}
        {state.phase === 'result' && (
          <div className="stack">
            <AnswerReveal
              kind={state.last?.kind === 'correct' ? 'correct' : 'miss'}
              title={state.last?.kind === 'correct'
                ? `${nameOf(state.last.uid ?? '')} got it! +${state.last.points}${settings.teamMode === 'teams' ? ` for ${teamName(winnerTeam ?? '')}` : ''}`
                : state.last?.kind === 'nobody' ? 'Nobody buzzed' : 'Everyone has had a turn'}
              answer={q?.answer ?? ''}
              typed={state.last?.kind === 'correct' ? state.last.typed : undefined}
              note={bonusNext && winnerTeam ? `${teamName(winnerTeam)} gets the bonus.` : undefined} />
            {isHost
              ? <div><button ref={nextRef} className="primary" disabled={!nextReady} onClick={() => hostRef.current?.next()}>{bonusNext ? 'Start the bonus' : isLast ? 'Finish game' : 'Next question'}</button></div>
              : <p className="muted">Waiting for the host…</p>}
          </div>
        )}
      </section>
    </>
  );
}

// ------------------------------------------------------------------ pieces

function PlayersByTeam({ players, teamMode, teamCount, meUid, onTeam, hostUid }: {
  players: [string, RoomPlayer][]; teamMode: 'teams' | 'ffa'; teamCount: number; meUid: string; onTeam: (t: string) => void; hostUid: string;
}) {
  if (teamMode === 'ffa') {
    return (
      <div>
        <h3>Players ({players.length})</h3>
        <ul>{players.map(([uid, p]) => <li key={uid}>{p.name}{uid === hostUid ? ' (host)' : ''}{uid === meUid ? ' (you)' : ''}</li>)}</ul>
      </div>
    );
  }
  const teams = TEAM_IDS.slice(0, teamCount);
  return (
    <div className="grid-2">
      {teams.map((t) => (
        <div key={t} className="panel" style={{ background: 'var(--surface-2)' }}>
          <h3 style={{ marginTop: 0 }}>{teamLabel(t)}</h3>
          <ul>{players.filter(([, p]) => p.team === t).map(([uid, p]) => <li key={uid}>{p.name}{uid === hostUid ? ' (host)' : ''}{uid === meUid ? ' (you)' : ''}</li>)}</ul>
          {players.some(([uid, p]) => uid === meUid && p.team !== t) && <button className="small" onClick={() => onTeam(t)}>Join {teamLabel(t)}</button>}
        </div>
      ))}
    </div>
  );
}

function Scoreboard({ teamOf, teamScores, players, teamMode, meUid, teamName }: {
  teamOf: Record<string, string>; teamScores: Record<string, number>; players: Record<string, RoomPlayer>; teamMode: 'teams' | 'ffa'; meUid: string; teamName: (t: string) => string;
}) {
  const ranked = rankTeams({ teamOf, teamScores });
  const myTeam = teamOf[meUid];
  return (
    <div className="stat-tiles">
      {ranked.map((r) => (
        <div key={r.team} className="tile" style={r.team === myTeam ? { outline: '2px solid var(--accent, #6aa9ff)' } : undefined}>
          <small>{teamMode === 'teams' ? teamName(r.team) : (players[r.team]?.name ?? 'Player')}{r.team === myTeam ? ' (you)' : ''}</small>
          <b>{r.points}</b>
        </div>
      ))}
    </div>
  );
}

function PlayerTable({ teamOf, playerScores, players }: { teamOf: Record<string, string>; playerScores: Record<string, PlayerScore>; players: Record<string, RoomPlayer> }) {
  const rows = Object.keys(teamOf).map((uid) => ({ uid, s: playerScores[uid] ?? { points: 0, correct: 0, wrong: 0, passes: 0 } }))
    .sort((a, b) => b.s.points - a.s.points);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Player</th><th>Tossup points</th><th>Correct</th><th>Wrong</th><th>Passes</th></tr></thead>
        <tbody>{rows.map(({ uid, s }) => <tr key={uid}><td>{players[uid]?.name ?? 'Player'}</td><td>{s.points}</td><td>{s.correct}</td><td>{s.wrong}</td><td>{s.passes}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function ReadingControls({ store, code, state, segment, taking, now, lastMiss }: {
  store: RoomStore; code: string; state: RoomState; segment: string; taking: boolean; now: number; lastMiss: string | null;
}) {
  const lockedOut = state.lockedOut.includes(store.uid);
  const buzzedSegment = useRef<string | null>(null);
  const alreadyBuzzed = buzzedSegment.current === segment || state.pending.some((p) => p.uid === store.uid);
  const canBuzz = taking && !lockedOut && !alreadyBuzzed && now >= state.readStartAt - 300;
  const [, force] = useState(0);

  const buzz = useCallback(() => {
    if (!canBuzz) return;
    buzzedSegment.current = segment;
    force((n) => n + 1);
    void sendBuzz(store, code, segment);
  }, [canBuzz, segment, store, code]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); buzz(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buzz]);

  const secondsLeft = Math.max(0, Math.ceil((state.endAt - now) / 1000));
  const finishedReading = wordsShown(state, now) >= state.wordCount;
  return (
    <div className="stack">
      {lastMiss && <div className="notice">{lastMiss}</div>}
      <div className="row">
        <button className="primary room-buzz" disabled={!canBuzz} onClick={buzz}>
          {!taking ? 'Watching' : lockedOut ? 'Locked out' : alreadyBuzzed ? 'Buzzed…' : 'BUZZ (Space)'}
        </button>
        {finishedReading && <span className="muted">Buzz window closes in {secondsLeft}s</span>}
      </div>
    </div>
  );
}

function AnsweringControls({ store, code, state, segment, now, buzzerName }: {
  store: RoomStore; code: string; state: RoomState; segment: string; now: number; buzzerName: string;
}) {
  const mine = state.buzzer === store.uid;
  const [text, setText] = useState('');
  const sent = useRef(false);
  const textRef = useRef('');
  textRef.current = text;
  const remainingMs = (state.answerDeadline ?? now) - now;

  const submit = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    void sendAnswer(store, code, segment, textRef.current);
  }, [store, code, segment]);

  // When the clock is nearly out, send whatever is typed (a blank box is a pass).
  useEffect(() => {
    if (mine && remainingMs <= 400) submit();
  }, [mine, remainingMs, submit]);

  if (!mine) {
    return <div className="notice"><strong>{buzzerName}</strong> buzzed in and is answering… <span className="muted">{Math.max(0, Math.ceil(remainingMs / 1000))}s</span></div>;
  }
  return (
    <div className="stack">
      <div className="row">
        <input autoFocus type="text" value={text} placeholder="Type your answer and press Enter" style={{ flex: 1 }}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        <button className="primary" onClick={submit}>Submit</button>
        <span className="room-clock">{Math.max(0, Math.ceil(remainingMs / 1000))}s</span>
      </div>
      <p className="hint">You buzzed in. A blank answer or running out of time is a pass with no penalty; a wrong answer costs a point.</p>
    </div>
  );
}
