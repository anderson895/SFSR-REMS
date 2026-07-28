/**
 * End-to-end verification against the live Firebase project.
 *
 *   npm run verify -- <adminEmail> <adminPassword>
 *
 * Imports the SAME `createReservation` / `approveReservation` that the two apps
 * call, and writes through the ordinary client SDK, so `firestore.rules` is
 * enforced exactly as it is for a real user. A test that reimplements the thing
 * it is testing proves nothing, so this one does not.
 *
 * Everything it creates is removed again in the cleanup step.
 *
 * NOTE: .env is loaded by `--env-file=.env` in the npm script, not in this
 * file. ESM hoists imports above statements, so a `process.loadEnvFile()` call
 * here would run AFTER SFSR-Shared/src/firebase.ts had already tried to read
 * its configuration — and failed.
 *
 * NOTE: the Firebase SDK is taken from ../SFSR-Shared/src/sdk, never imported
 * directly. See the comment in that file.
 */

import {
  ReservationSource,
  UnitStatus,
  UnitUnavailableError,
  approveReservation,
  auth,
  createReservation,
  db,
} from '../SFSR-Shared/src/index';
import {
  collection,
  createUserWithEmailAndPassword,
  deleteDoc,
  deleteUser,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  signInWithEmailAndPassword,
  updateDoc,
  where,
} from '../SFSR-Shared/src/sdk';

const [adminEmail, adminPassword] = process.argv.slice(2);

if (!adminEmail || !adminPassword) {
  console.error('Usage: npm run verify -- <adminEmail> <adminPassword>');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const stamp = Date.now();
const buyerEmail = `verify_buyer_${stamp}@example.com`;
const rivalEmail = `verify_rival_${stamp}@example.com`;
const PASSWORD = `Verify!${stamp}`;
const NAME = { firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz' };

const created = {
  reservationIds: [] as string[],
  userUids: [] as string[],
  unitId: '',
};

/** Signs the single shared auth instance in as a given account. */
const as = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

async function registerBuyerAccount(email: string): Promise<string> {
  const cred = await createUserWithEmailAndPassword(auth, email, PASSWORD);
  created.userUids.push(cred.user.uid);
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: 'buyer',
    accountType: 'initial',
    ...NAME,
    email,
    active: true,
    createdAt: serverTimestamp(),
  });
  return cred.user.uid;
}

async function main() {
  console.log(
    `\nSFSR-REMS end-to-end verification -> ${process.env.VITE_FIREBASE_PROJECT_ID}\n`,
  );

  // ------------------------------------------------------------ [1] setup
  console.log('[1/7] Accounts and inventory');

  await as(adminEmail, adminPassword);
  console.log(`  signed in as admin ${adminEmail}`);

  const availableSnap = await getDocs(
    query(
      collection(db, 'units'),
      where('status', '==', UnitStatus.AVAILABLE),
      limit(1),
    ),
  );
  if (availableSnap.empty) {
    throw new Error('No available units. Run `npm run migrate` first.');
  }
  created.unitId = availableSnap.docs[0].id;
  const u = availableSnap.docs[0].data();
  console.log(`  target unit: ${u.building} ${u.unitNo} (${created.unitId})`);

  const buyerUid = await registerBuyerAccount(buyerEmail);
  check('buyer can self-register with role "buyer"', true);

  // ------------------------------------------- [2] privilege escalation
  console.log('\n[2/7] Buyer cannot escalate their own privileges');

  let escalationBlocked = false;
  try {
    await updateDoc(doc(db, 'users', buyerUid), { role: 'admin' });
  } catch {
    escalationBlocked = true;
  }
  check('rules block a buyer setting their own role to admin', escalationBlocked);

  // -------------------------------------------------------- [3] the race
  console.log('\n[3/7] Double-booking race -- two simultaneous reservations');

  const buyerSnapshot = {
    ...NAME,
    email: buyerEmail,
    mobile: '09171234567',
    address: 'Mandaluyong City',
  };
  const reserveArgs = {
    unitId: created.unitId,
    buyer: buyerSnapshot,
    buyerUid,
    source: ReservationSource.ONLINE,
    createdBy: buyerUid,
  };

  // Both hit the same unit at the same moment through the real transaction.
  const results = await Promise.allSettled([
    createReservation(reserveArgs),
    createReservation(reserveArgs),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled') created.reservationIds.push(r.value);
  }
  const winners = results.filter((r) => r.status === 'fulfilled');
  const losers = results.filter((r) => r.status === 'rejected');

  check(
    'exactly one reservation succeeded',
    winners.length === 1,
    `${winners.length} succeeded, ${losers.length} failed`,
  );
  check(
    'the loser was rejected as unavailable',
    losers.length === 1 &&
      losers[0].status === 'rejected' &&
      losers[0].reason instanceof UnitUnavailableError,
    losers[0]?.status === 'rejected' ? String(losers[0].reason) : 'nothing rejected',
  );

  const held = await getDoc(doc(db, 'units', created.unitId));
  check(
    'unit status is now ON HOLD',
    held.data()?.status === UnitStatus.ON_HOLD,
    `got "${held.data()?.status}"`,
  );
  check(
    'unit records which reservation holds it',
    held.data()?.heldBy === created.reservationIds[0],
  );

  // ------------------------------------------------- [4] a rival buyer
  console.log('\n[4/7] A second buyer cannot touch the held unit or reservation');

  await registerBuyerAccount(rivalEmail);

  let grabBlocked = false;
  try {
    await updateDoc(doc(db, 'units', created.unitId), {
      status: UnitStatus.ON_HOLD,
      heldBy: 'forged-reservation-id',
    });
  } catch {
    grabBlocked = true;
  }
  check('rules reject re-holding a unit that is already on hold', grabBlocked);

  let readBlocked = false;
  try {
    await getDoc(doc(db, 'reservations', created.reservationIds[0]));
  } catch {
    readBlocked = true;
  }
  check("rules reject reading another buyer's reservation", readBlocked);

  let approveBlocked = false;
  try {
    await updateDoc(doc(db, 'reservations', created.reservationIds[0]), {
      status: 'approved',
    });
  } catch {
    approveBlocked = true;
  }
  check('rules reject a buyer approving their own reservation', approveBlocked);

  // -------------------------------------------------------- [5] approval
  console.log('\n[5/7] Staff approval');

  await as(adminEmail, adminPassword);

  const before = await getDoc(doc(db, 'reservations', created.reservationIds[0]));
  check('reservation starts as pending', before.data()?.status === 'pending');

  await approveReservation(created.reservationIds[0], auth.currentUser!.uid);

  const after = await getDoc(doc(db, 'reservations', created.reservationIds[0]));
  check('reservation is approved', after.data()?.status === 'approved');

  const reserved = await getDoc(doc(db, 'units', created.unitId));
  check(
    'unit moved ON HOLD -> RESERVED',
    reserved.data()?.status === UnitStatus.RESERVED,
    `got "${reserved.data()?.status}"`,
  );

  const profile = await getDoc(doc(db, 'users', buyerUid));
  check(
    'buyer upgraded Initial -> Client account',
    profile.data()?.accountType === 'client',
    `got "${profile.data()?.accountType}"`,
  );

  // --------------------------------------------- [6] gone from the portal
  console.log('\n[6/7] Unit disappears from the public portal listing');

  const stillAvailable = await getDocs(
    query(collection(db, 'units'), where('status', '==', UnitStatus.AVAILABLE)),
  );
  check(
    'approved unit is no longer in the available listing',
    !stillAvailable.docs.some((d) => d.id === created.unitId),
    `${stillAvailable.size} units still available`,
  );
}

async function cleanup() {
  console.log('\n[7/7] Cleanup');
  try {
    await as(adminEmail, adminPassword);

    for (const id of created.reservationIds) {
      await deleteDoc(doc(db, 'reservations', id));
    }
    if (created.reservationIds.length) {
      console.log(`  removed ${created.reservationIds.length} test reservation(s)`);
    }

    if (created.unitId) {
      await updateDoc(doc(db, 'units', created.unitId), {
        status: UnitStatus.AVAILABLE,
        heldBy: null,
        updatedAt: serverTimestamp(),
      });
      console.log('  restored unit to AVAILABLE');
    }

    for (const uid of created.userUids) {
      await deleteDoc(doc(db, 'users', uid));
    }

    // Auth accounts can only be deleted by the account itself with the client
    // SDK, so sign in as each throwaway buyer one last time.
    for (const email of [buyerEmail, rivalEmail]) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, PASSWORD);
        await deleteUser(cred.user);
      } catch {
        /* account may not have been created */
      }
    }
    console.log('  removed test accounts');
  } catch (error) {
    console.error('  cleanup problem:', (error as Error).message);
    console.error('  check the reservations/users collections manually.');
  }
}

main()
  .catch((error) => {
    failed++;
    console.error('\nVerification aborted:', (error as Error).message);
  })
  .then(cleanup)
  .then(() => {
    console.log(
      failed === 0
        ? `\nAll ${passed} checks passed.\n`
        : `\n${passed} passed, ${failed} FAILED.\n`,
    );
    process.exit(failed === 0 ? 0 : 1);
  });
