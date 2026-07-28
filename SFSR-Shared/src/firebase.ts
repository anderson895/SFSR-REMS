/**
 * Single Firebase entry point shared by both applications.
 *
 * The Web Portal and the Internal Management System deliberately point at the
 * same Firebase project so that a change made in one is immediately visible in
 * the other — the "centralized database" requirement from the study.
 */

import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';
import { type Firestore, getFirestore } from 'firebase/firestore';
import { requireEnv } from './env';

export const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
};

export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

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
  UNITS: 'units',
  RESERVATIONS: 'reservations',
  DOCUMENTS: 'documents',
  AUDIT_LOGS: 'auditLogs',
  TRIPPING: 'trippingRequests',
} as const;
