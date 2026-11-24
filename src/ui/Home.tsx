import { lazy, Suspense } from 'react';
import { getRuleset } from '../core/rulesets';
import type { SessionKind } from '../core/session';
import type { Settings } from '../storage/storage';
import { navigate } from './context';
import { SettingsPanels } from './SettingsPanels';

// Hosting and joining rooms is only needed in Room mode, so it loads on demand.
const RoomLauncher = lazy(() => import('../multiplayer/RoomLauncher'));

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
  onStart: (kind: SessionKind) => void;
  busy: boolean;
  error: string | null;
  /** How many missed tossups / bonuses are saved for the current ruleset and level. */
  deck?: { tossups: number; bonuses: number };
  onStartDeck?: (kind: 'tossup' | 'bonus') => void;
  /** 'solo' (the default) or 'room' to host or join a room with friends; both share the same settings panels. */
  mode?: 'solo' | 'room';
}

export function Home({ settings, onChange, onStart, busy, error, deck, onStartDeck, mode = 'solo' }: Props) {
  const rs = getRuleset(settings.ruleset);
  const room = mode === 'room';

  return (
    <div className="page stack">
      <div>
        <h1>Practice</h1>
        <p className="muted">
          Type your answers and press <kbd>Enter</kbd>. Rules: {rs.name}.
        </p>
      </div>

      <div className="row" role="tablist" aria-label="Play mode">
        <button role="tab" aria-selected={!room} className={!room ? 'primary' : ''} onClick={() => navigate('/')}>Solo</button>
        <button role="tab" aria-selected={room} className={room ? 'primary' : ''} onClick={() => navigate('/rooms')}>With friends (room)</button>
      </div>

      {error && <div className="notice error">{error}</div>}

      {!room && (
        <div className="mode-buttons">
          <button className="primary" disabled={busy} onClick={() => onStart('tossup')}>
            <strong>Tossups</strong>
            <span className="small">One question at a time</span>
          </button>
          <button className="primary" disabled={busy} onClick={() => onStart('bonus')}>
            <strong>Bonus drill</strong>
            <span className="small">{rs.bonus.timing === 'together' ? 'All parts, one clock' : 'One part at a time'}</span>
          </button>
          <button className="primary" disabled={busy} onClick={() => onStart('sim')}>
            <strong>Game sim</strong>
            <span className="small">Tossups with a running score</span>
          </button>
        </div>
      )}

      {!room && deck && onStartDeck && deck.tossups + deck.bonuses > 0 && (
        <div className="notice row">
          <span><strong>Missed deck:</strong> {deck.tossups} tossup{deck.tossups === 1 ? '' : 's'} and {deck.bonuses} bonus{deck.bonuses === 1 ? '' : 'es'} you missed or passed on at this level. Get one right three times in a row and it leaves the deck.</span>
          {deck.tossups > 0 && <button disabled={busy} onClick={() => onStartDeck('tossup')}>Practice missed tossups</button>}
          {deck.bonuses > 0 && <button disabled={busy} onClick={() => onStartDeck('bonus')}>Practice missed bonuses</button>}
        </div>
      )}

      {room && (
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <RoomLauncher settings={settings} onChange={onChange} />
        </Suspense>
      )}

      <SettingsPanels settings={settings} onChange={onChange} mode={room ? 'room' : 'solo'} />
    </div>
  );
}
