import { createContext, useContext, useEffect, useState } from 'react';
import type { AdminUser } from '../data/repository';
import type { Services } from '../data/services';

export interface AppContextValue extends Services {
  user: AdminUser | null;
  isAdmin: boolean;
  /** False while the admin allowlist check for the signed-in user is still running. */
  adminChecked: boolean;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppContext missing');
  return v;
}

/** Minimal hash router: returns the current path, e.g. "/admin/edit/abc". */
export function useRoute(): string {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

export function navigate(path: string) {
  window.location.hash = path;
}
