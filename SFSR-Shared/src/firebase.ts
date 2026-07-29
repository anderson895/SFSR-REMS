/**
 * Single Firebase entry point shared by both applications.
 *
 * The Web Portal and the Internal Management System deliberately point at the
 * same Firebase project so that a change made in one is immediately visible in
 * the other — the "centralized database" requirement from the study.
 */

import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  type Firestore,
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { readEnv, requireEnv } from './env';

export const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
};

/** True when VITE_USE_EMULATOR=true. Commenting the line out is enough to unset it. */
const USE_EMULATOR = readEnv('VITE_USE_EMULATOR') === 'true';

/**
 * The emulator runs under its own Firebase app name.
 *
 * Not cosmetic. The persistent cache below is stored in IndexedDB under a key
 * derived from the app name and the project id — and the emulator uses the same
 * project id as production, `sfsr-rems`. Sharing one app name would therefore
 * share one cache between the two, so switching VITE_USE_EMULATOR would leave
 * yesterday's local test units sitting in front of the real inventory until the
 * cache happened to resync. Two names, two caches, no bleed.
 */
const APP_NAME = USE_EMULATOR ? 'sfsr-emulator' : undefined;

const existingApp = getApps().find((a) =>
  APP_NAME ? a.name === APP_NAME : a.name === '[DEFAULT]',
);

const isNewApp = !existingApp;

export const app: FirebaseApp =
  existingApp ??
  (APP_NAME ? initializeApp(firebaseConfig, APP_NAME) : initializeApp(firebaseConfig));

export const auth: Auth = getAuth(app);

/**
 * Firestore with an on-disk cache.
 *
 * Firestore bills one read per document *every time a listener attaches*, not
 * just the first time. During development Vite reloads modules on every file
 * save, which detaches and re-attaches every listener and re-reads its whole
 * result set from the server. That is how a day of editing burned 52,000 reads
 * against 712 writes — a 73:1 ratio.
 *
 * A persistent cache lets a re-attaching listener resync from IndexedDB and
 * pay only for documents that actually changed. `persistentMultipleTabManager`
 * is required because the Portal and the Internal system are routinely open in
 * several tabs at once, and without it only the first tab gets a cache.
 *
 * Falls back to the default in-memory cache where IndexedDB is unavailable,
 * such as a Node script or a browser in private mode.
 */
function createDb(): Firestore {
  if (!isNewApp) return getFirestore(app);

  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db: Firestore = createDb();

/**
 * Point both SDKs at the local Firebase emulators when VITE_USE_EMULATOR=true.
 *
 * Development against the emulator costs no quota at all, which matters on the
 * free Spark plan where a normal day of editing can exhaust the 50,000 daily
 * reads before lunch.
 */
if (isNewApp && USE_EMULATOR) {
  const host = readEnv('VITE_EMULATOR_HOST') ?? '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  console.info(`[SFSR] Using Firebase EMULATORS at ${host} — no quota is used.`);
} else if (isNewApp) {
  // Logged so it is never a guess which database a screen is showing. Most of
  // the confusing bugs in this project came from not knowing.
  console.info(
    `[SFSR] Using the LIVE Firebase project "${firebaseConfig.projectId}".`,
  );
}

/**
 * A second, isolated Firebase app used only when an admin creates a staff
 * account.
 *
 * `createUserWithEmailAndPassword` signs the new user in on whichever app
 * instance it is called against, which would kick the admin out of their own
 * session. Running it on a throwaway secondary instance leaves the admin's
 * session on the primary app untouched. This is the standard workaround for
 * projects that cannot use Cloud Functions (those require the paid Blaze plan).
 */
export function getAdminWorkerAuth(): Auth {
  const name = 'admin-worker';
  const existing = getApps().find((a) => a.name === name);
  return getAuth(existing ?? initializeApp(firebaseConfig, name));
}

/** Firestore collection names, centralised to avoid typo drift across apps. */
export const COLLECTIONS = {
  USERS: 'users',
  PROJECTS: 'projects',
  UNIT_TYPES: 'unitTypes',
  UNITS: 'units',
  RESERVATIONS: 'reservations',
  DOCUMENTS: 'documents',
  AUDIT_LOGS: 'auditLogs',
  TRIPPING: 'trippingRequests',
} as const;
