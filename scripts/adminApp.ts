/**
 * Privileged Firebase connection used by the migration script.
 *
 * The Admin SDK bypasses `firestore.rules`, which is exactly what a migration
 * needs. Those rules deliberately forbid anyone from creating a staff account
 * (self-registration is pinned to `buyer`) and forbid non-staff from writing
 * units. That is not an oversight to work around in the app — it is what stops
 * a stranger from making themselves an administrator. The migration breaks the
 * deadlock with real Google credentials instead of by weakening the rules.
 *
 * Two ways to authenticate, checked in this order:
 *
 *   1. serviceAccountKey.json in the repo root (gitignored)
 *   2. Application Default Credentials from the gcloud CLI
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.loadEnvFile('.env');

export const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'sfsr-rems';

function buildApp() {
  const keyPath = resolve(process.cwd(), 'serviceAccountKey.json');

  if (existsSync(keyPath)) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    console.log('  credentials: serviceAccountKey.json');
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }

  console.log('  credentials: Application Default Credentials (gcloud)');
  return initializeApp({ projectId: PROJECT_ID });
}

const app = getApps().length ? getApps()[0] : buildApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

/**
 * Turns the usual credential failures into instructions rather than a stack
 * trace, since this is the one error a new developer will actually hit.
 */
export function explainCredentialError(error: unknown): string {
  const message = (error as Error)?.message ?? String(error);
  const code = (error as { code?: string })?.code ?? '';

  const looksLikeCredentials =
    message.includes('Could not load the default credentials') ||
    message.includes('Unable to detect a Project Id') ||
    message.includes('invalid_grant') ||
    message.includes('UNAUTHENTICATED') ||
    code === 'app/invalid-credential' ||
    code === 7 ||
    code === 16;

  if (!looksLikeCredentials) return message;

  return [
    'No usable Google credentials were found.',
    '',
    'Pick ONE of these, then run the migration again.',
    '',
    'Option A — gcloud (no files to manage):',
    '  gcloud auth application-default login',
    `  gcloud auth application-default set-quota-project ${PROJECT_ID}`,
    '',
    'Option B — service account key:',
    '  Firebase Console -> Project settings -> Service accounts',
    '  -> Generate new private key',
    '  Save it as serviceAccountKey.json in the repo root (already gitignored).',
    '',
    `Original error: ${message}`,
  ].join('\n');
}
