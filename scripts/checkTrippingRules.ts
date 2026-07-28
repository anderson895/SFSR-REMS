/**
 * Proves the tripping rules hold.
 *
 *   npx tsx scripts/checkTrippingRules.ts
 *
 * `trippingRequests` is the only collection an unauthenticated client may
 * write to. That is a deliberate trade — leads arrive before accounts do — but
 * it means the rules are the entire defence, so they get tested rather than
 * trusted. Each case runs on its own Firebase app: a write the rules reject
 * stays in that client's retry queue and poisons every later call on the same
 * instance.
 *
 * Cleans up anything it manages to create.
 */

import { type FirebaseApp, deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  type Firestore,
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { adminDb } from './adminApp';

process.loadEnvFile('.env');

const CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.VITE_FIREBASE_APP_ID!,
};

let appSeq = 0;
const created: string[] = [];
let failures = 0;

function freshApp(): { app: FirebaseApp; db: Firestore } {
  const app = initializeApp(CONFIG, `probe-${appSeq++}`);
  return { app, db: getFirestore(app) };
}

function report(passed: boolean, label: string, detail = '') {
  console.log(
    `  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`,
  );
  if (!passed) failures++;
}

/** A request that should be accepted from anyone. */
function validPayload() {
  return {
    projectName: 'The Legaspi Place',
    fullName: 'Rules Probe',
    email: 'probe@example.com',
    mobile: '09170000000',
    preferredDate: '2026-12-01',
    preferredSlot: '09:00 AM – 11:00 AM',
    partySize: 2,
    message: 'automated rule check',
    status: 'pending',
    requestedByUid: null,
    createdAt: serverTimestamp(),
  };
}

async function expectWrite(
  label: string,
  payload: Record<string, unknown>,
  shouldSucceed: boolean,
) {
  const { app, db } = freshApp();
  let ok = false;
  let detail = '';

  try {
    const ref = await addDoc(collection(db, 'trippingRequests'), payload);
    created.push(ref.id);
    ok = true;
    detail = 'accepted';
  } catch (error) {
    detail = (error as { code?: string }).code ?? (error as Error).message;
  }

  report(ok === shouldSucceed, label, detail);
  await deleteApp(app).catch(() => {});
}

async function main() {
  console.log('\nTripping rule checks\n');

  // --- the intended case --------------------------------------------------
  await expectWrite(
    'a signed-out visitor CAN file a valid request',
    validPayload(),
    true,
  );

  // --- shape attacks ------------------------------------------------------
  await expectWrite(
    'cannot self-confirm (status must be pending)',
    { ...validPayload(), status: 'confirmed' },
    false,
  );

  await expectWrite(
    'cannot smuggle in extra fields',
    { ...validPayload(), isVip: true, internalNote: 'x' },
    false,
  );

  await expectWrite(
    'cannot claim another account (requestedByUid)',
    { ...validPayload(), requestedByUid: 'someone-elses-uid' },
    false,
  );

  await expectWrite(
    'rejects a malformed date',
    { ...validPayload(), preferredDate: 'next tuesday' },
    false,
  );

  await expectWrite(
    'rejects a malformed email',
    { ...validPayload(), email: 'not-an-email' },
    false,
  );

  await expectWrite(
    'rejects an oversized message',
    { ...validPayload(), message: 'x'.repeat(501) },
    false,
  );

  await expectWrite(
    'rejects an implausible party size',
    { ...validPayload(), partySize: 500 },
    false,
  );

  // --- leads must not be publicly readable --------------------------------
  {
    const { app, db } = freshApp();
    let blocked = false;
    let detail = '';
    try {
      await getDocs(query(collection(db, 'trippingRequests'), limit(1)));
      detail = 'the read SUCCEEDED — every lead is public';
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      blocked = code === 'permission-denied';
      detail = code;
    }
    report(blocked, 'a signed-out visitor CANNOT read other leads', detail);
    await deleteApp(app).catch(() => {});
  }

  // --- a buyer must not be able to confirm their own visit -----------------
  if (created.length > 0) {
    const { app, db } = freshApp();
    let blocked = false;
    let detail = '';
    try {
      await signInWithEmailAndPassword(
        getAuth(app),
        'juan.delacruz@sfsr.test',
        'Buyer@2026',
      );
      await updateDoc(doc(db, 'trippingRequests', created[0]), {
        status: 'confirmed',
      });
      detail = 'the update SUCCEEDED — a buyer can confirm their own booking';
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      blocked = code === 'permission-denied';
      detail = code;
    }
    report(blocked, 'a buyer CANNOT confirm a request themselves', detail);
    await deleteApp(app).catch(() => {});
  }

  // --- cleanup ------------------------------------------------------------
  for (const id of created) {
    await adminDb.collection('trippingRequests').doc(id).delete();
  }
  console.log(`\n  cleaned up ${created.length} probe document(s)`);

  console.log(
    failures === 0
      ? '\nAll checks passed.\n'
      : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\n' + ((error as Error).message ?? String(error)));
  process.exit(1);
});
