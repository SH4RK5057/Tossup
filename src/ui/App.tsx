import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { levelsForPool } from '../core/pool';
import { getRuleset } from '../core/rulesets';
import { createSession, reduce, type Action, type SessionKind, type SessionState } from '../core/session';
import { summarize, type SessionSummary } from '../core/stats';
import type { AdminUser } from '../data/repository';
import { loadServices, type Services } from '../data/services';
import { loadSettings, saveSession, saveSettings, type Settings } from '../storage/storage';
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

  const startSession = useCallback(async (kind: SessionKind) => {
    setBusy(true);
    setError(null);
    try {
      const rs = getRuleset(settings.ruleset);
      const pool = await services.repo.loadPool({
        rulesetId: rs.id, level: settings.level, levels: levelsForPool(rs, settings.level),
      });
      const state = createSession({
        pool,
        seed: Math.random().toString(36).slice(2),
        rulesetId: rs.id,
        level: settings.level,
        kind,
        filter: { subjects: settings.subjects, fullDistribution: settings.fullDistribution },
        settings: {
          tossupSeconds: settings.tossupUntimed ? null : settings.tossupSeconds,
          bonusSeconds: settings.bonusUntimed ? null : settings.bonusSeconds,
          bonusesOn: settings.bonusesOn,
        },
        length: kind !== 'sim' ? { kind: 'all' } : settings.simLength === 'match' ? { kind: 'match' } : { kind: 'count', n: settings.simCount },
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
    setSummary(sum);
    navigate('/summary');
  }, []);

  const quit = useCallback(() => dispatch({ type: 'end' }), [dispatch]);

  const path = route.split('?')[0];
  let page;
  if (path === '/play') {
    page = session
      ? <Play session={session} dispatch={dispatch} onDone={finishSession} onQuit={quit} onEdit={setEditingId} paused={editingId !== null} />
      : <Home settings={settings} onChange={setSettings} onStart={startSession} busy={busy} error={error} />;
  } else if (path === '/summary') {
    page = summary
      ? <Summary summary={summary} onAgain={() => startSession(lastKind)} onHome={() => navigate('/')} />
      : <Home settings={settings} onChange={setSettings} onStart={startSession} busy={busy} error={error} />;
  } else if (path === '/stats') {
    page = <StatsPage initialRuleset={settings.ruleset} />;
  } else if (path.startsWith('/admin')) {
    page = <Suspense fallback={<div className="page muted">Loading…</div>}><AdminShell path={path} /></Suspense>;
  } else {
    page = <Home settings={settings} onChange={setSettings} onStart={startSession} busy={busy} error={error} />;
  }

  const cycleTheme = () => setSettings({ ...settings, theme: settings.theme === 'auto' ? 'dark' : settings.theme === 'dark' ? 'light' : 'auto' });

  return (
    <AppContext.Provider value={{ ...services, user, isAdmin, adminChecked }}>
      <header className="topbar">
        <a className="brand" href="#/">TOSSUP</a>
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
