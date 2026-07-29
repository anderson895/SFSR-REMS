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

/**
 * When the apps are pointed at the emulators, the scripts must follow — a
 * migration that seeds the real project while the app reads the emulator looks
 * like the seed silently did nothing.
 *
 * The Admin SDK switches targets purely through these two variables, and needs
 * no credentials at all once they are set.
 */
/**
 * Passing `--production` overrides VITE_USE_EMULATOR for a single command.
 *
 * Without it, a developer set up for local work has to edit .env to touch the
 * real project and remember to change it back — and forgetting either half is
 * silent. A repair aimed at production would quietly fix the emulator instead,
 * leaving the live site broken and the operator convinced it was fixed.
 */
const FORCE_PRODUCTION = process.argv.includes('--production');

export const USING_EMULATOR =
  !FORCE_PRODUCTION && process.env.VITE_USE_EMULATOR === 'true';

if (USING_EMULATOR) {
  const host = process.env.VITE_EMULATOR_HOST ?? '127.0.0.1';
  process.env.FIRESTORE_EMULATOR_HOST ??= `${host}:8080`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${host}:9099`;
}

function buildApp() {
  if (USING_EMULATOR) {
    console.log(
      `  target: LOCAL EMULATOR (${process.env.FIRESTORE_EMULATOR_HOST}) — no quota used`,
    );
    return initializeApp({ projectId: PROJECT_ID });
  }

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
  // gRPC surfaces numeric status codes while the Admin SDK uses strings, so
  // this has to accept both.
  const code = (error as { code?: string | number })?.code ?? '';

  // Firestore reports an exhausted free-tier allowance as gRPC code 8. Worth
  // naming explicitly: it arrives during an ordinary write and reads as though
  // the script itself is broken.
  if (
    code === 8 ||
    code === 'resource-exhausted' ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('Quota exceeded')
  ) {
    return [
      'Firestore refused the operation: the daily free-tier quota is used up.',
      '',
      'Nothing was written. The database is read-only until the quota resets at',
      'midnight US Pacific — about 3-4 PM Manila time.',
      '',
      'Until then, work against the local emulator, which costs nothing:',
      '  set VITE_USE_EMULATOR=true in .env',
      '  npm run emulators',
      '',
      'Then re-run this command once the quota has reset.',
    ].join('\n');
  }

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
