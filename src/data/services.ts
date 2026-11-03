import { createDevAuth, noAuth, SeedRepository } from './seedRepository';
import type { AuthService, QuestionRepository } from './repository';

export interface Services {
  repo: QuestionRepository;
  auth: AuthService;
}

const firebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
const devAdmin = import.meta.env.DEV && import.meta.env.VITE_DEV_ADMIN === '1';

/**
 * Picks the data backend. With no Firebase config the app runs entirely on seed/questions.json,
 * so local development needs no Firebase project. Firebase is loaded lazily to keep the
 * seed-only bundle small.
 */
export async function loadServices(): Promise<Services> {
  if (firebaseConfigured) {
    const { createFirebase } = await import('./firestoreRepository');
    return createFirebase();
  }
  if (devAdmin) return { repo: new SeedRepository(undefined, true), auth: createDevAuth() };
  return { repo: new SeedRepository(), auth: noAuth };
}
