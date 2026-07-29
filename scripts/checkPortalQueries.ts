/**
 * Runs every query the buyer portal issues, as a real buyer, and checks the
 * rules permit them.
 *
 *   npx tsx scripts/checkPortalQueries.ts
 *
 * Exists because of a bug none of the other checks could catch. Firestore
 * rules are not filters: for a *query* the server must be able to prove every
 * result is readable before it will run it. A rule of
 *
 *   resource.data.buyerUid == request.auth.uid
 *
 * is therefore only satisfiable when the query itself constrains `buyerUid`.
 * The portal listed a reservation's documents filtering on `reservationId`
 * alone, so the server refused it — while the same query succeeded for staff,
 * whose `isStaff()` branch short-circuits the rule.
 *
 * It was invisible in normal use: documents the client had just written came
 * back from the local cache, so the list looked right until a reload with a
 * cold cache silently emptied it.
 *
 * These assertions are about *permission*, not about results. An empty result
 * is fine; permission-denied is the failure.
 */

import { type FirebaseApp, deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  type Firestore,
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  where,
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

const BUYER = { email: 'juan.delacruz@sfsr.test', password: 'Buyer@2026' };

let failures = 0;

function report(passed: boolean, label: string, detail = '') {
  console.log(
    `  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`,
  );
  if (!passed) failures++;
}

async function main() {
  console.log('\nPortal query permission checks\n');

  const app: FirebaseApp = initializeApp(CONFIG, 'portal-queries');
  const credential = await signInWithEmailAndPassword(
    getAuth(app),
    BUYER.email,
    BUYER.password,
  );
  const db: Firestore = getFirestore(app);
  const uid = credential.user.uid;

  async function permitted(label: string, build: () => ReturnType<typeof query>) {
    try {
      const snap = await getDocs(build());
      report(true, label, `${snap.size} row(s)`);
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      report(false, label, code || (error as Error).message);
    }
  }

  async function refused(label: string, build: () => ReturnType<typeof query>) {
    try {
      await getDocs(build());
      report(false, label, 'the query SUCCEEDED when it should not have');
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      report(code === 'permission-denied', label, code);
    }
  }

  // --- MyReservationsPage / useMyReservations ----------------------------
  await permitted('list own reservations', () =>
    query(
      collection(db, 'reservations'),
      where('buyerUid', '==', uid),
      orderBy('createdAt', 'desc'),
    ),
  );

  // --- useActionItems: rejected documents across all reservations --------
  await permitted('list own rejected documents', () =>
    query(
      collection(db, 'documents'),
      where('buyerUid', '==', uid),
      where('status', '==', 'rejected'),
    ),
  );

  // --- ReservationDetailPage / useReservationDocuments -------------------
  // The shape that was broken. `buyerUid` is what makes it provable.
  await permitted("list one reservation's own documents", () =>
    query(
      collection(db, 'documents'),
      where('reservationId', '==', 'any-reservation-id'),
      where('buyerUid', '==', uid),
      orderBy('uploadedAt'),
    ),
  );

  // The original, unprovable shape. Kept as a check so the constraint cannot
  // be dropped again without this failing loudly.
  await refused('the same query WITHOUT buyerUid is refused', () =>
    query(
      collection(db, 'documents'),
      where('reservationId', '==', 'any-reservation-id'),
      orderBy('uploadedAt'),
    ),
  );

  // --- UnitsPage / useBrowsableUnits (public) ----------------------------
  await permitted('browse units', () =>
    query(
      collection(db, 'units'),
      where('status', 'in', ['available', 'on_hold']),
      orderBy('price'),
    ),
  );

  // --- a buyer must not be able to sweep the whole documents collection --
  await refused('a buyer cannot list every document', () =>
    query(collection(db, 'documents')),
  );

  await refused('a buyer cannot list every reservation', () =>
    query(collection(db, 'reservations')),
  );

  await deleteApp(app).catch(() => {});

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
