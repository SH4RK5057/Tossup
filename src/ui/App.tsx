import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PACE_MULTIPLIER } from '../core/clock';
import { levelsForPool, subjectKey } from '../core/pool';
import { getRuleset } from '../core/rulesets';
import { deckFor, updateDeck, type Deck } from '../core/deck';
import { buildReview, missedQuestions, type ReviewItem } from '../core/review';
import { createSession, reduce, type Action, type SessionKind, type SessionState } from '../core/session';
import { LEVELS, type Bonus, type Level, type RulesetId, type Tossup } from '../core/types';
import { summarize, type SessionSummary } from '../core/stats';
import type { AdminUser } from '../data/repository';
import { loadServices, type Services } from '../data/services';
import { loadDeck, loadSettings, saveDeck, saveSession, saveSettings, type Settings } from '../storage/storage';
import { AppContext, navigate, useRoute } from './context';
import { Home } from './Home';
import { Play } from './Play';
import { StatsPage } from './StatsPage';
import { Summary } from './Summary';

const AdminShell = lazy(() => import('../admin/AdminShell'));
const EditorModal = lazy(() => import('../admin/EditorModal'));

export function App() {
  const [services, setServices] = useState<Services | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    loadServices().then(setServices, (e) => setLoadError(String(e)));
  }, []);
  if (loadError) return <div className="page"><div className="notice error">Could not start: {loadError}</div></div>;
  if (!services) return <div className="page muted">Loading…</div>;
  return <Main services={services} />;
}

function Main({ services }: { services: Services }) {
  const route = useRoute();
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [session, setSession] = useState<SessionState | null>(null);
  const sessionRef = useRef<SessionState | null>(null);
  sessionRef.current = session;
  const finished = useRef(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [deck, setDeck] = useState<Deck>(loadDeck);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [missed, setMissed] = useState<{ rulesetId: RulesetId; level: Level; tossups: Tossup[]; bonuses: Bonus[] } | null>(null);
  const [lastKind, setLastKind] = useState<SessionKind>('tossup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const setSettings = useCallback((next: Settings) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  useEffect(() => {
    if (settings.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    return services.auth.onChange((u) => {
      setUser(u);
      setIsAdmin(false);
      setAdminChecked(!u);
      if (u) {
        services.repo.isAdmin(u.uid).then(setIsAdmin, () => setIsAdmin(false)).finally(() => setAdminChecked(true));
      }
    });
  }, [services]);

  const dispatch = useCallback((a: Action) => setSession((s) => (s ? reduce(s, a) : s)), []);

  const startSession = useCallback(async (kind: SessionKind, override?: Partial<Settings>) => {
    const cfg: Settings = override ? { ...settings, ...override } : settings;
    setBusy(true);
    setError(null);
    try {
      const rs = getRuleset(cfg.ruleset);
      const pool = await services.repo.loadPool({
        rulesetId: rs.id, level: cfg.level, levels: levelsForPool(rs, cfg.level),
      });
      const state = createSession({
        pool,
        seed: Math.random().toString(36).slice(2),
        rulesetId: rs.id,
        level: cfg.level,
        kind,
        filter: { subjects: cfg.subjects, fullDistribution: cfg.fullDistribution, difficulties: cfg.difficulties },
        settings: {
          tossupSeconds: cfg.tossupUntimed ? null : cfg.tossupSeconds,
          ...(cfg.tossupTiming === 'scaled' ? { tossupPace: PACE_MULTIPLIER[cfg.tossupPace] } : {}),
          bonusSeconds: cfg.bonusUntimed ? null : cfg.bonusSeconds,
          ...(cfg.bonusTiming === 'scaled' ? { bonusPace: PACE_MULTIPLIER[cfg.tossupPace] } : {}),
          bonusesOn: cfg.bonusesOn,
        },
        length: kind !== 'sim' || cfg.simLength === 'all' ? { kind: 'all' } : cfg.simLength === 'match' ? { kind: 'match' } : { kind: 'count', n: cfg.simCount },
        nowIso: new Date().toISOString(),
      });
      if (state.phase === 'done') {
        setError(kind === 'bonus'
          ? 'No bonuses match these settings. Try other subjects or another level.'
          : 'No questions match these settings. Try other subjects or another level.');
        return;
      }
      finished.current = false;
      setLastKind(kind);
      setSession(state);
      navigate('/play');
    } catch (e) {
      setError(`Could not load questions: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [services, settings]);

  const finishSession = useCallback(() => {
    const s = sessionRef.current;
    if (!s || finished.current) return;
    finished.current = true;
    if (s.records.length === 0) { navigate('/'); return; }
    const sum = summarize(s, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, new Date().toISOString());
    saveSession(sum);
    const nextDeck = updateDeck(loadDeck(), s, new Date().toISOString());
    saveDeck(nextDeck);
    setDeck(nextDeck);
    setSummary(sum);
    setReview(buildReview(s));
    setMissed({ rulesetId: s.rulesetId, level: s.level, ...missedQuestions(s) });
    navigate('/summary');
  }, []);

  /** Practice again only the questions missed in the session just finished. */
  const retryMissed = useCallback((kind: 'tossup' | 'bonus') => {
    if (!missed) return;
    const pool = kind === 'tossup' ? missed.tossups : missed.bonuses;
    if (pool.length === 0) return;
    const state = createSession({
      pool,
      seed: Math.random().toString(36).slice(2),
      rulesetId: missed.rulesetId,
      level: missed.level,
      kind,
      filter: { subjects: [], fullDistribution: false },
      settings: {
        tossupSeconds: settings.tossupUntimed ? null : settings.tossupSeconds,
        ...(settings.tossupTiming === 'scaled' ? { tossupPace: PACE_MULTIPLIER[settings.tossupPace] } : {}),
        bonusSeconds: settings.bonusUntimed ? null : settings.bonusSeconds,
        ...(settings.bonusTiming === 'scaled' ? { bonusPace: PACE_MULTIPLIER[settings.tossupPace] } : {}),
        bonusesOn: false,
      },
      length: { kind: 'all' },
      nowIso: new Date().toISOString(),
    });
    if (state.phase === 'done') return;
    finished.current = false;
    setLastKind(kind);
    setSession(state);
    navigate('/play');
  }, [missed, settings]);

  /** Practice the saved missed-question deck for the current ruleset and level. */
  const startDeck = useCallback(async (kind: 'tossup' | 'bonus') => {
    const ids = new Set(deckFor(deck, settings.ruleset, settings.level, kind).map((e) => e.id));
    if (ids.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const rs = getRuleset(settings.ruleset);
      const all = await services.repo.loadPool({ rulesetId: rs.id, level: settings.level, levels: levelsForPool(rs, settings.level) });
      const pool = all.filter((q) => ids.has(q.id));
      const state = createSession({
        pool,
        seed: Math.random().toString(36).slice(2),
        rulesetId: rs.id,
        level: settings.level,
        kind,
        filter: { subjects: [], fullDistribution: false },
        settings: {
          tossupSeconds: settings.tossupUntimed ? null : settings.tossupSeconds,
          ...(settings.tossupTiming === 'scaled' ? { tossupPace: PACE_MULTIPLIER[settings.tossupPace] } : {}),
          bonusSeconds: settings.bonusUntimed ? null : settings.bonusSeconds,
          ...(settings.bonusTiming === 'scaled' ? { bonusPace: PACE_MULTIPLIER[settings.tossupPace] } : {}),
          bonusesOn: false,
        },
        length: { kind: 'all' },
        nowIso: new Date().toISOString(),
      });
      if (state.phase === 'done') { setError('None of the saved missed questions are in the question bank any more.'); return; }
      finished.current = false;
      setLastKind(kind);
      setSession(state);
      navigate('/play');
    } catch (e) {
      setError(`Could not load questions: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [deck, services, settings]);

  /** Drill the subjects the player struggles on (from the stats page). */
  const drillSubjects = useCallback((rulesetId: RulesetId, keys: string[]) => {
    const rs = getRuleset(rulesetId);
    // NCAL subjects belong to a level; practice at the highest level among the chosen subjects.
    const levels = rs.subjects.flatMap((c) => c.subjects.filter((s) => keys.includes(subjectKey(c.name, s.name))).map((s) => s.level));
    const rank = (l: Level) => LEVELS.indexOf(l);
    const level = levels.filter((l): l is Level => Boolean(l)).sort((a, b) => rank(b) - rank(a))[0] ?? settings.level;
    const next: Settings = { ...settings, ruleset: rulesetId, level, subjects: keys, fullDistribution: false };
    setSettings(next);
    void startSession('tossup', next);
  }, [settings, setSettings, startSession]);

  const quit = useCallback(() => dispatch({ type: 'end' }), [dispatch]);

  const deckInfo = {
    tossups: deckFor(deck, settings.ruleset, settings.level, 'tossup').length,
    bonuses: deckFor(deck, settings.ruleset, settings.level, 'bonus').length,
  };
  const path = route.split('?')[0];
  let page;
  if (path === '/play') {
    page = session
      ? <Play session={session} dispatch={dispatch} onDone={finishSession} onQuit={quit} onEdit={setEditingId} paused={editingId !== null} />
      : <Home settings={settings} onChange={setSettings} onStart={startSession} busy={busy} error={error} deck={deckInfo} onStartDeck={startDeck} />;
  } else if (path === '/summary') {
    page = summary
      ? <Summary summary={summary} review={review} onRetry={retryMissed} onAgain={() => startSession(lastKind)} onHome={() => navigate('/')} />
      : <Home settings={settings} onChange={setSettings} onStart={startSession} busy={busy} error={error} deck={deckInfo} onStartDeck={startDeck} />;
  } else if (path === '/stats') {
    page = <StatsPage initialRuleset={settings.ruleset} onDrill={drillSubjects} />;
  } else if (path.startsWith('/admin')) {
    page = <Suspense fallback={<div className="page muted">Loading…</div>}><AdminShell path={path} /></Suspense>;
  } else {
    page = <Home settings={settings} onChange={setSettings} onStart={startSession} busy={busy} error={error} deck={deckInfo} onStartDeck={startDeck} />;
  }

  const cycleTheme = () => setSettings({ ...settings, theme: settings.theme === 'auto' ? 'dark' : settings.theme === 'dark' ? 'light' : 'auto' });

  return (
    <AppContext.Provider value={{ ...services, user, isAdmin, adminChecked }}>
      <header className="topbar">
        <a className="brand" href="#/">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={26} height={26} style={{ verticalAlign: '-7px', marginRight: 8 }} />
          TOSSUP
        </a>
        <nav>
          <a href="#/" className={path === '/' ? 'active' : ''}>Practice</a>
          <a href="#/stats" className={path === '/stats' ? 'active' : ''}>Stats</a>
          {(services.auth.available || path.startsWith('/admin')) && (
            <a href="#/admin" className={path.startsWith('/admin') ? 'active' : ''}>Admin</a>
          )}
          <button className="link" onClick={cycleTheme} title="Switch theme">Theme: {settings.theme}</button>
        </nav>
      </header>
      {page}
      {editingId && (
        <Suspense fallback={null}>
          <EditorModal id={editingId} onClose={() => setEditingId(null)} />
        </Suspense>
      )}
    </AppContext.Provider>
  );
}
