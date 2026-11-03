import { useState } from 'react';
import { useApp } from '../ui/context';
import { QuestionBrowser } from './QuestionBrowser';
import { EditorPage } from './EditorPage';
import { ImportPage } from './ImportPage';
import { ReportsQueue } from './ReportsQueue';

const TABS: [string, string][] = [
  ['/admin', 'Questions'],
  ['/admin/import', 'Import & verify'],
  ['/admin/reports', 'Reports'],
];

function SignIn() {
  const { auth } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="stack" style={{ maxWidth: 360 }} onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      auth.signIn(email.trim(), password).catch(() => setError('Sign-in failed. Check the email and password.'));
    }}>
      <label className="field"><span className="lbl">Email</span>
        <input type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span className="lbl">Password</span>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', width: '100%' }} /></label>
      {error && <div className="notice error">{error}</div>}
      <div><button className="primary" type="submit">Sign in</button></div>
    </form>
  );
}

export default function AdminShell({ path }: { path: string }) {
  const { auth, user, isAdmin, adminChecked } = useApp();

  if (!auth.available) {
    return (
      <div className="page stack">
        <h1>Admin</h1>
        <div className="notice">
          Admin tools need a Firebase project. This build is running on the seed file only.
          See the README, “Firebase setup”, to enable email/password sign-in and Firestore.
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page stack">
        <h1>Admin</h1>
        <p className="muted">Sign in with the admin email and password.</p>
        <SignIn />
      </div>
    );
  }

  if (!adminChecked) return <div className="page muted">Checking access…</div>;

  if (!isAdmin) {
    return (
      <div className="page stack">
        <h1>Admin</h1>
        <div className="notice error">
          {user.email ?? 'This account'} is not on the admin allowlist. To grant access, add this UID to the
          <code> uids </code> array of the <code>config/admin</code> document in Firestore:
          <div className="json" style={{ marginTop: '0.5rem' }}>{user.uid}</div>
        </div>
        <div><button onClick={() => auth.signOut()}>Sign out</button></div>
      </div>
    );
  }

  const editMatch = /^\/admin\/edit\/(.+)$/.exec(path);
  return (
    <div className="page stack">
      <div className="row">
        {TABS.map(([href, label]) => (
          <a key={href} href={`#${href}`} style={{ fontWeight: path === href ? 700 : 400 }}>{label}</a>
        ))}
        <span style={{ flex: 1 }} />
        <span className="muted small">{user.email}</span>
        <button onClick={() => auth.signOut()}>Sign out</button>
      </div>
      {editMatch ? <EditorPage id={decodeURIComponent(editMatch[1])} />
        : path === '/admin/import' ? <ImportPage />
        : path === '/admin/reports' ? <ReportsQueue />
        : <QuestionBrowser />}
    </div>
  );
}
