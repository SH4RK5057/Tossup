// The Rooms screen: create or join a room, lobby, buzz-in play, scoreboard.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeRoomState, rankTeams, segmentOf, wordsShown, type RoomState,
} from '../core/room';
import { levelsForPool } from '../core/pool';
import { getRuleset } from '../core/rulesets';
import { DIFFICULTIES, LEVELS, LEVEL_LABEL, type Level, type Tossup } from '../core/types';
import { subjectKey } from '../core/pool';
import { navigate, useApp } from '../ui/context';
import { connect, realtimeConfigured, type Connection } from './connect';
import { RoomHost, sendAnswer, sendBuzz, writePlayer, type RoomPlayer } from './host';
import {
  buildRoomQuestions, poolSignature, READING_SPEEDS, revealedText, TEAM_IDS, teamLabel, toHostQuestions, type RoomSettings,
} from './questions';
import { makeRoomCode, normalizeRoomCode, roomPath, SERVER_TIME, type RoomStore } from './store';

interface Meta { hostUid: string; createdAt: number; settings: RoomSettings }

const NAME_KEY = 'tossup.room.name';
const ROOM_KEY = 'tossup.room.active';
const MAX_PLAYERS = 30;

const read = (k: string) => { try { return window.localStorage.getItem(k) ?? ''; } catch { return ''; } };
const write = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } };
// The room you are in is remembered per tab (a reload keeps you in it; a new tab starts fresh).
const readTab = (k: string) => { try { return window.sessionStorage.getItem(k) ?? ''; } catch { return ''; } };
const writeTab = (k: string, v: string) => { try { window.sessionStorage.setItem(k, v); } catch { /* ignore */ } };

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

function readOnce(store: RoomStore, path: string): Promise<unknown> {
  return new Promise((resolve) => {
    let off: (() => void) | null = null;
    let done = false;
    off = store.onValue(path, (v) => {
      if (done) return;
      done = true;
      resolve(v);
      queueMicrotask(() => off?.());
    });
  });
}

export default function RoomsPage({ code: urlCode }: { code: string | null }) {
  const [conn, setConn] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const forceLocal = new URLSearchParams(window.location.hash.split('?')[1] ?? '').has('local');
  useEffect(() => {
    connect(forceLocal).then(setConn, (e) => setError(String(e)));
  }, [forceLocal]);

  const [name, setName] = useState(() => read(NAME_KEY));
  const [code, setCode] = useState<string | null>(() => urlCode ?? (readTab(ROOM_KEY) || null));
  useEffect(() => { if (urlCode) setCode(urlCode); }, [urlCode]);

  if (error) return <div className="page"><div className="notice error">{error}</div></div>;
  if (!conn) return <div className="page muted">Connecting…</div>;

  const leave = () => {
    writeTab(ROOM_KEY, '');
    setCode(null);
    navigate('/rooms');
  };

  return (
    <div className="page stack">
      <h1>Rooms</h1>
      {conn.note && <div className="notice">{conn.note}</div>}
      {code
        ? <RoomView store={conn.store} code={code} onLeave={leave} />
        : <Entry store={conn.store} name={name} setName={(n) => { setName(n); write(NAME_KEY, n); }}
            onEnter={(c) => { writeTab(ROOM_KEY, c); setCode(c); navigate(`/rooms?code=${c}`); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ create or join

function Entry({ store, name, setName, onEnter }: { store: RoomStore; name: string; setName: (n: string) => void; onEnter: (code: string) => void }) {
  const { repo } = useApp();
  const [joinCode, setJoinCode] = useState('');
  const [level, setLevel] = useState<Level>('jv');
  const [questions, setQuestions] = useState(10);
  const [speed, setSpeed] = useState<number>(READING_SPEEDS[1].wordsPerSecond);
  const [teamMode, setTeamMode] = useState<'teams' | 'ffa'>('teams');
  const [teamCount, setTeamCount] = useState(2);
  const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rs = getRuleset('ncal');
  const trimmed = name.trim();

  const create = async () => {
    if (!trimmed) { setError('Type your name first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const pool = await repo.loadPool({ rulesetId: 'ncal', level, levels: levelsForPool(rs, level) });
      const subjects = rs.subjects.filter((c) => cats.includes(c.name)).flatMap((c) => c.subjects.map((s) => subjectKey(c.name, s.name)));
      const settings: RoomSettings = {
        rulesetId: 'ncal', level, subjects, difficulties: [...DIFFICULTIES], wordsPerSecond: speed, teamMode, teamCount,
        questions, seed: Math.random().toString(36).slice(2), nowIso: new Date().toISOString(), bankSig: poolSignature(pool),
      };
      if (buildRoomQuestions(pool, settings).length === 0) { setError('No questions match those settings.'); return; }
      let code = makeRoomCode();
      for (let i = 0; i < 20 && (await readOnce(store, roomPath(code, 'meta'))) !== null; i++) code = makeRoomCode();
      await store.set(roomPath(code, 'meta'), { hostUid: store.uid, createdAt: SERVER_TIME, settings });
      await writePlayer(store, code, trimmed, 'A');
      onEnter(code);
    } catch (e) {
      setError(`Could not create the room: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    const c = normalizeRoomCode(joinCode);
    if (!trimmed) { setError('Type your name first.'); return; }
    if (c.length !== 4) { setError('A room code is 4 letters.'); return; }
    setBusy(true);
    setError(null);
    try {
      const meta = (await readOnce(store, roomPath(c, 'meta'))) as Meta | null;
      if (!meta) { setError('No room with that code.'); return; }
      const players = ((await readOnce(store, roomPath(c, 'players'))) as Record<string, RoomPlayer> | null) ?? {};
      const state = (await readOnce(store, roomPath(c, 'state'))) as RoomState | null;
      const mine = players[store.uid];
      if (!mine) {
        if (Object.keys(players).length >= MAX_PLAYERS) { setError(`That room is full (${MAX_PLAYERS} players).`); return; }
        // Put new players on the smallest team.
        const counts = new Map<string, number>(TEAM_IDS.slice(0, meta.settings.teamCount).map((t) => [t, 0]));
        for (const p of Object.values(players)) counts.set(p.team, (counts.get(p.team) ?? 0) + 1);
        const team = [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
        await writePlayer(store, c, trimmed, team);
      }
      if (state && state.phase !== 'lobby' && !mine) setError(null); // joins as a spectator
      onEnter(c);
    } catch (e) {
      setError(`Could not join: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && <div className="notice error">{error}</div>}
      <section className="panel stack">
        <label className="field">
          <span className="lbl">Your name</span>
          <input type="text" value={name} maxLength={20} placeholder="Name shown to the room" onChange={(e) => setName(e.target.value)} />
        </label>
      </section>
      <div className="grid-2">
        <section className="panel stack">
          <h2>Join a room</h2>
          <label className="field">
            <span className="lbl">Room code</span>
            <input type="text" value={joinCode} maxLength={4} placeholder="ABCD" style={{ textTransform: 'uppercase', letterSpacing: '0.3em', fontSize: '1.4rem', maxWidth: 160 }}
              onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') void join(); }} />
          </label>
          <div><button className="primary" disabled={busy} onClick={join}>Join</button></div>
        </section>
        <section className="panel stack">
          <h2>Host a room</h2>
          <label className="field">
            <span className="lbl">Level</span>
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
          </label>
          <div className="field">
            <span className="lbl">Categories (none selected = all)</span>
            <div className="row">
              {rs.subjects.filter((c) => c.name !== 'Current Events').map((c) => (
                <label key={c.name} className="inline-check small">
                  <input type="checkbox" checked={cats.includes(c.name)}
                    onChange={(e) => setCats(e.target.checked ? [...cats, c.name] : cats.filter((x) => x !== c.name))} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="row">
            <label className="field"><span className="lbl">Questions</span>
              <select value={questions} onChange={(e) => setQuestions(Number(e.target.value))}>{[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="field"><span className="lbl">Reading speed</span>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{READING_SPEEDS.map((r) => <option key={r.label} value={r.wordsPerSecond}>{r.label}</option>)}</select></label>
          </div>
          <div className="row">
            <label className="field"><span className="lbl">Play as</span>
              <select value={teamMode} onChange={(e) => setTeamMode(e.target.value as 'teams' | 'ffa')}>
                <option value="teams">Teams</option><option value="ffa">Free for all</option></select></label>
            {teamMode === 'teams' && (
              <label className="field"><span className="lbl">Number of teams</span>
                <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            )}
          </div>
          <div><button className="primary" disabled={busy} onClick={create}>Create room</button></div>
        </section>
      </div>
      {!realtimeConfigured && <p className="hint">NCAL questions. Rooms use the baked question bank, so nothing is read from the database during play.</p>}
    </>
  );
}

// ------------------------------------------------------------------ inside a room

function RoomView({ store, code, onLeave }: { store: RoomStore; code: string; onLeave: () => void }) {
  const { repo } = useApp();
  const meta = useValue<Meta>(store, roomPath(code, 'meta'));
  const players = useValue<Record<string, RoomPlayer>>(store, roomPath(code, 'players'));
  const stored = useValue<RoomState>(store, roomPath(code, 'state'));
  const state = useMemo(() => normalizeRoomState(stored), [stored]);
  const isHost = !!meta && meta.hostUid === store.uid;

  // Everyone builds the same question list from the host's seed.
  const [tossups, setTossups] = useState<Tossup[] | null>(null);
  const [sigOk, setSigOk] = useState(true);
  useEffect(() => {
    if (!meta) return;
    const s = meta.settings;
    let live = true;
    const rs = getRuleset(s.rulesetId);
    repo.loadPool({ rulesetId: s.rulesetId, level: s.level, levels: levelsForPool(rs, s.level) }).then((pool) => {
      if (!live) return;
      setSigOk(poolSignature(pool) === s.bankSig);
      setTossups(buildRoomQuestions(pool, s));
    }, () => { if (live) setTossups([]); });
    return () => { live = false; };
  }, [repo, meta?.settings.seed]); // eslint-disable-line react-hooks/exhaustive-deps

  // The host's screen runs the referee.
  const hostRef = useRef<RoomHost | null>(null);
  const initialRef = useRef<RoomState | null | undefined>(undefined);
  if (stored !== undefined && initialRef.current === undefined) initialRef.current = stored ? normalizeRoomState(stored) : null;
  useEffect(() => {
    if (!isHost || !meta || !tossups || tossups.length === 0 || stored === undefined) return;
    const host = new RoomHost({
      store, code, questions: toHostQuestions(tossups, meta.settings.rulesetId), teamMode: meta.settings.teamMode,
      wordsPerSecond: meta.settings.wordsPerSecond, scoring: { correct: getRuleset(meta.settings.rulesetId).tossupValue, wrong: getRuleset(meta.settings.rulesetId).wrongTossupPoints },
      initialState: initialRef.current ?? null,
    });
    hostRef.current = host;
    return () => { host.dispose(); hostRef.current = null; };
  }, [isHost, meta?.settings.seed, tossups, stored === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw ten times a second so the reveal and the clocks run smoothly.
  const [, force] = useState(0);
  useEffect(() => { const id = setInterval(() => force((n) => n + 1), 100); return () => clearInterval(id); }, []);

  if (meta === undefined || players === undefined || stored === undefined) return <p className="muted">Joining room {code}…</p>;
  if (meta === null) {
    return <div className="notice row"><span>Room {code} is closed or does not exist.</span><button onClick={onLeave}>Back</button></div>;
  }

  const me = players?.[store.uid];
  const playerList = Object.entries(players ?? {}).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
  const nameOf = (uid: string) => players?.[uid]?.name ?? 'Someone';
  const teamOfUid = (uid: string) => (meta.settings.teamMode === 'teams' ? (players?.[uid]?.team ?? uid) : uid);

  const closeRoom = async () => { await store.remove(roomPath(code)); onLeave(); };
  const leaveRoom = async () => {
    if (state.phase === 'lobby') await store.remove(roomPath(code, 'players', store.uid));
    onLeave();
  };
  const changeTeam = (team: string) => { if (me) void writePlayer(store, code, me.name, team); };

  const header = (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div><strong>Room {code}</strong> <span className="muted small">· {LEVEL_LABEL[meta.settings.level]} · {meta.settings.questions} tossups · {meta.settings.teamMode === 'teams' ? `${meta.settings.teamCount} teams` : 'free for all'}</span></div>
      <div className="row">
        {isHost ? <button className="danger" onClick={() => { if (confirm('Close the room for everyone?')) void closeRoom(); }}>Close room</button>
          : <button onClick={() => void leaveRoom()}>Leave</button>}
      </div>
    </div>
  );

  const hostHint = isHost ? <p className="hint">You are hosting: keep this tab open and in view, because your screen runs the clocks and scoring for everyone.</p> : null;

  if (!sigOk) {
    return <>{header}<div className="notice error">Your copy of the site has a different question bank than the host's. Reload the page (or clear the cache) and rejoin.</div></>;
  }

  // ---- lobby
  if (state.phase === 'lobby') {
    const share = `${window.location.origin}${window.location.pathname}#/rooms?code=${code}`;
    return (
      <>
        {header}
        {hostHint}
        <section className="panel stack">
          <div className="row" style={{ alignItems: 'baseline' }}>
            <span className="lbl">Share this code</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '0.3em' }}>{code}</span>
            <button className="link small" onClick={() => { void navigator.clipboard?.writeText(share); }}>Copy link</button>
          </div>
          <PlayersByTeam players={playerList} teamMode={meta.settings.teamMode} teamCount={meta.settings.teamCount} meUid={store.uid} onTeam={changeTeam} hostUid={meta.hostUid} />
          {!me && <p className="hint">You are not in this room. Go back and join with the code.</p>}
          {isHost
            ? <div className="row">
                <button className="primary" disabled={!tossups || tossups.length === 0 || playerList.length === 0} onClick={() => hostRef.current?.start()}>Start game</button>
                {!tossups && <span className="muted small">Loading questions…</span>}
              </div>
            : <p className="muted">Waiting for the host to start…</p>}
        </section>
      </>
    );
  }

  const now = store.now();
  const q = tossups?.[state.q];
  const shown = wordsShown(state, now);
  const taking = state.teamOf[store.uid] !== undefined;
  const segment = segmentOf(state);

  const scoreboard = <Scoreboard state={state} players={players ?? {}} teamMode={meta.settings.teamMode} meUid={store.uid} />;

  // ---- finished
  if (state.phase === 'done') {
    const ranked = rankTeams(state);
    const winner = ranked[0];
    return (
      <>
        {header}
        <section className="panel stack">
          <h2>Game over</h2>
          {winner && <p style={{ fontSize: '1.2rem' }}>Winner: <strong>{meta.settings.teamMode === 'teams' ? teamLabel(winner.team) : nameOf(winner.team)}</strong> with {winner.points} points</p>}
          {scoreboard}
          <PlayerTable state={state} players={players ?? {}} />
          <div><button className="primary" onClick={() => (isHost ? void closeRoom() : onLeave())}>{isHost ? 'Close room' : 'Leave room'}</button></div>
        </section>
      </>
    );
  }

  const isLast = state.q + 1 >= state.total;
  return (
    <>
      {header}
      {hostHint}
      {scoreboard}
      <section className="panel stack">
        <div className="muted small">Question {state.q + 1} of {state.total}{taking ? '' : ' · you are watching this game'}</div>
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
            <div className={`notice${state.last?.kind === 'correct' ? '' : ''}`}>
              {state.last?.kind === 'correct' && <><strong>{nameOf(state.last.uid ?? '')}</strong> got it (+{state.last.points} for {teamLabel(teamOfUid(state.last.uid ?? ''))}). </>}
              {state.last?.kind === 'nobody' && <>Nobody buzzed. </>}
              {(state.last?.kind === 'wrong' || state.last?.kind === 'pass') && <>Everyone has had a turn. </>}
              Answer: <strong>{q?.answer}</strong>
            </div>
            {isHost
              ? <div><button className="primary" autoFocus onClick={() => hostRef.current?.next()}>{isLast ? 'Finish game' : 'Next question'}</button></div>
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

function Scoreboard({ state, players, teamMode, meUid }: { state: RoomState; players: Record<string, RoomPlayer>; teamMode: 'teams' | 'ffa'; meUid: string }) {
  const ranked = rankTeams(state);
  const myTeam = state.teamOf[meUid];
  return (
    <div className="stat-tiles">
      {ranked.map((r) => (
        <div key={r.team} className="tile" style={r.team === myTeam ? { outline: '2px solid var(--accent, #6aa9ff)' } : undefined}>
          <small>{teamMode === 'teams' ? teamLabel(r.team) : (players[r.team]?.name ?? 'Player')}{r.team === myTeam ? ' (you)' : ''}</small>
          <b>{r.points}</b>
        </div>
      ))}
    </div>
  );
}

function PlayerTable({ state, players }: { state: RoomState; players: Record<string, RoomPlayer> }) {
  const rows = Object.keys(state.teamOf).map((uid) => ({ uid, s: state.playerScores[uid] ?? { points: 0, correct: 0, wrong: 0, passes: 0 } }))
    .sort((a, b) => b.s.points - a.s.points);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Player</th><th>Points</th><th>Correct</th><th>Wrong</th><th>Passes</th></tr></thead>
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
