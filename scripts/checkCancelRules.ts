/**
 * Proves the cancellation rules actually hold.
 *
 *   npx tsx scripts/checkCancelRules.ts
 *
 * `buyerReleasingOwnHold()` is the one rule in this system that lets a buyer
 * move a unit *out* of `on_hold`. Get it wrong and any signed-in account can
 * free someone else's reservation and take the unit — the exact double-selling
 * failure the study exists to prevent. A comment claiming it is safe is not
 * evidence, so this signs in as a real second buyer and tries the attack.
 *
 * Read-only in effect: whatever it changes, it puts back.
 */

import { type FirebaseApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  type Firestore,
  doc,
  getDoc,
  getDocs,
  collection,
  getFirestore,
  query,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';

process.loadEnvFile('.env');

const CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.VITE_FIREBASE_APP_ID!,
};

/**
 * One isolated app per identity.
 *
 * Signing out and back in on a single app is not enough: a write rejected by
 * the rules stays in that client's retry queue, and every later operation on
 * the same Firestore instance fails behind it. Separate apps keep the rejected
 * attack from contaminating the check that follows it.
 */
async function signedInAs(
  name: string,
  email: string,
  password: string,
): Promise<{ app: FirebaseApp; db: Firestore; uid: string }> {
  const app = initializeApp(CONFIG, name);
  const credential = await signInWithEmailAndPassword(
    getAuth(app),
    email,
    password,
  );
  return { app, db: getFirestore(app), uid: credential.user.uid };
}

const OWNER = { email: 'juan.delacruz@sfsr.test', password: 'Buyer@2026' };
const ATTACKER = { email: 'maria.santos@sfsr.test', password: 'Buyer@2026' };

let failures = 0;

function report(passed: boolean, label: string, detail = '') {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!passed) failures++;
}

/** The write a malicious client would attempt: free the unit, then grab it. */
async function attemptRelease(
  db: Firestore,
  unitId: string,
  price: number,
  unitNo: string,
) {
  await updateDoc(doc(db, 'units', unitId), {
    status: 'available',
    heldBy: null,
    price,
    unitNo,
  });
}

async function main() {
  console.log('\nCancellation rule checks\n');

  const owner = await signedInAs('owner', OWNER.email, OWNER.password);
  const attacker = await signedInAs(
    'attacker',
    ATTACKER.email,
    ATTACKER.password,
  );

  // Find a unit that is currently on hold, and who holds it.
  const held = await getDocs(
    query(
      collection(owner.db, 'units'),
      where('status', '==', 'on_hold'),
      limit(1),
    ),
  );

  if (held.empty) {
    console.log(
      '  SKIP  no unit is currently on hold.\n' +
        '        Reserve a unit in the portal first, then re-run.\n',
    );
    process.exit(0);
  }

  const unitDoc = held.docs[0];
  const unit = unitDoc.data();
  console.log(`  unit ${unit.unitNo} is on hold by reservation ${unit.heldBy}\n`);

  // The holding reservation may be unreadable for two very different reasons:
  // it belongs to someone else (rules deny the read), or it no longer exists.
  // Both surface as a thrown error to a buyer client, so neither may be
  // allowed to abort the run.
  let ownedByOwner = false;
  let ownerReadNote = '';
  try {
    const reservationSnap = await getDoc(
      doc(owner.db, 'reservations', unit.heldBy),
    );
    if (!reservationSnap.exists()) {
      ownerReadNote = 'the reservation named in heldBy does not exist';
    } else {
      ownedByOwner = reservationSnap.data().buyerUid === owner.uid;
      if (!ownedByOwner) ownerReadNote = 'held by a different buyer';
    }
  } catch (error) {
    ownerReadNote = `could not read it (${(error as { code?: string }).code})`;
  }

  // --- the attack ---------------------------------------------------------
  let attackBlocked = false;
  let attackDetail = '';
  try {
    await attemptRelease(attacker.db, unitDoc.id, unit.price, unit.unitNo);
    attackDetail = "the write SUCCEEDED — a buyer can steal another buyer's unit";
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    attackBlocked = code === 'permission-denied';
    attackDetail = code || (error as Error).message;
  }
  report(
    attackBlocked,
    "a different buyer cannot release someone else's hold",
    attackDetail,
  );

  // --- the legitimate case ------------------------------------------------
  if (!ownedByOwner) {
    console.log(
      `  SKIP  positive case not checked — ${ownerReadNote}.\n` +
        '        Reserve a unit as the owner account, then re-run.',
    );
  } else {
    let allowed = false;
    let detail = '';
    try {
      await attemptRelease(owner.db, unitDoc.id, unit.price, unit.unitNo);
      allowed = true;
      // Put it back exactly as found.
      await updateDoc(doc(owner.db, 'units', unitDoc.id), {
        status: 'on_hold',
        heldBy: unit.heldBy,
        price: unit.price,
        unitNo: unit.unitNo,
      });
      detail = 'released, then restored';
    } catch (error) {
      detail = (error as { code?: string }).code ?? (error as Error).message;
    }
    report(allowed, 'the holding buyer CAN release their own hold', detail);
  }

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
