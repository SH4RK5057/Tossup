/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** Dev builds only: fake admin sign-in against the in-memory seed repository. */
  readonly VITE_DEV_ADMIN?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
