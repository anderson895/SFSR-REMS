/**
 * Proves the tripping rules hold.
 *
 *   npx tsx scripts/checkTrippingRules.ts
 *
 * Site visits require a signed-in buyer, and the rules also constrain the
 * shape of what that buyer may write. Both halves are checked here: an
 * anonymous client must be refused outright, and a signed-in one must still be
 * unable to self-confirm, claim another account, or smuggle in extra fields.
 *
 * Each case runs on its own Firebase app — a write the rules reject stays in
 * that client's retry queue and poisons every later call on the same instance.
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
  getDoc,
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

async function signedInAs(
  name: string,
  email: string,
  password: string,
): Promise<{ app: FirebaseApp; db: Firestore; uid: string }> {
  const app = initializeApp(CONFIG, `${name}-${appSeq++}`);
  const credential = await signInWithEmailAndPassword(
    getAuth(app),
    email,
    password,
  );
  return { app, db: getFirestore(app), uid: credential.user.uid };
}

function report(passed: boolean, label: string, detail = '') {
  console.log(
    `  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`,
  );
  if (!passed) failures++;
}

const BUYER = { email: 'juan.delacruz@sfsr.test', password: 'Buyer@2026' };

/** A request that should be accepted from the signed-in owner. */
function validPayload(uid: string) {
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
    requestedByUid: uid,
    createdAt: serverTimestamp(),
  };
}

/**
 * @param as 'buyer' signs in first; 'anon' stays unauthenticated.
 */
async function expectWrite(
  label: string,
  payload: Record<string, unknown>,
  shouldSucceed: boolean,
  as: 'buyer' | 'anon' = 'buyer',
) {
  const { app, db } = freshApp();
  let ok = false;
  let detail = '';

  try {
    if (as === 'buyer') {
      await signInWithEmailAndPassword(
        getAuth(app),
        BUYER.email,
        BUYER.password,
      );
    }
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

  // The signed-in buyer's uid is needed to build a payload that should pass.
  const owner = await signedInAs('owner', BUYER.email, BUYER.password);
  const uid = owner.uid;
  await deleteApp(owner.app).catch(() => {});

  // --- authentication is required ----------------------------------------
  await expectWrite(
    'a signed-out visitor CANNOT file a request',
    validPayload(uid),
    false,
    'anon',
  );

  // --- the intended case --------------------------------------------------
  await expectWrite(
    'a signed-in buyer CAN file a valid request',
    validPayload(uid),
    true,
  );

  // --- shape attacks, all as a legitimately signed-in buyer ---------------
  await expectWrite(
    'cannot self-confirm (status must be pending)',
    { ...validPayload(uid), status: 'confirmed' },
    false,
  );

  await expectWrite(
    'cannot smuggle in extra fields',
    { ...validPayload(uid), isVip: true, internalNote: 'x' },
    false,
  );

  await expectWrite(
    'cannot file on behalf of another account',
    { ...validPayload(uid), requestedByUid: 'someone-elses-uid' },
    false,
  );

  // The old rules allowed a null uid for anonymous leads. They no longer do,
  // and this is the case that would silently pass if that clause came back.
  await expectWrite(
    'cannot leave the request unowned (null uid)',
    { ...validPayload(uid), requestedByUid: null },
    false,
  );

  await expectWrite(
    'rejects a malformed date',
    { ...validPayload(uid), preferredDate: 'next tuesday' },
    false,
  );

  await expectWrite(
    'rejects a malformed email',
    { ...validPayload(uid), email: 'not-an-email' },
    false,
  );

  await expectWrite(
    'rejects an oversized message',
    { ...validPayload(uid), message: 'x'.repeat(501) },
    false,
  );

  await expectWrite(
    'rejects an implausible party size',
    { ...validPayload(uid), partySize: 500 },
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
    const { app, db } = await signedInAs('owner2', BUYER.email, BUYER.password);
    let blocked = false;
    let detail = '';
    try {
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

  // --- one buyer must not read another buyer's lead -----------------------
  // Now that every request is owned, ownership has to actually mean something.
  if (created.length > 0) {
    const { app, db } = await signedInAs(
      'other',
      'maria.santos@sfsr.test',
      'Buyer@2026',
    );
    let blocked = false;
    let detail = '';
    try {
      await getDoc(doc(db, 'trippingRequests', created[0]));
      detail = "the read SUCCEEDED — buyers can see each other's requests";
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      blocked = code === 'permission-denied';
      detail = code;
    }
    report(blocked, "a buyer CANNOT read another buyer's request", detail);
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
