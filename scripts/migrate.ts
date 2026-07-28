/**
 * One-command Firebase setup.
 *
 *   npm run migrate -- <adminEmail> <adminPassword>
 *
 * Replaces the manual "open the Firebase Console and change role to admin"
 * step. Every action is idempotent: re-running reports what already exists and
 * changes nothing, so it is safe to run on a half-configured project or after a
 * failure partway through.
 *
 * Deliberately does NOT delete anything. A migration that can wipe a database
 * is one typo away from destroying a defense demo.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { PROJECT_ID, adminAuth, adminDb, explainCredentialError } from './adminApp';
import { buildSeedUnits } from './unitData';

const [email, password, firstName = 'System', lastName = 'Administrator'] =
  process.argv.slice(2);

let created = 0;
let skipped = 0;

const step = (n: number, title: string) =>
  console.log(`\n[${n}/4] ${title}`);
const ok = (msg: string) => console.log(`  + ${msg}`);
const same = (msg: string) => console.log(`  = ${msg}`);

async function ensureAdmin(): Promise<string> {
  let uid: string;

  try {
    const existing = await adminAuth.getUserByEmail(email);
    uid = existing.uid;
    await adminAuth.updateUser(uid, { password });
    same(`auth account ${email} already exists (password reset)`);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    const account = await adminAuth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });
    uid = account.uid;
    ok(`created auth account ${email}`);
    created++;
  }

  const profileRef = adminDb.collection('users').doc(uid);
  const snap = await profileRef.get();

  if (snap.exists && snap.data()?.role === 'admin') {
    same('user profile already has role: admin');
    skipped++;
  } else {
    // merge:true so re-running never clobbers a name the admin has since edited.
    await profileRef.set(
      {
        role: 'admin',
        accountType: 'initial',
        firstName,
        middleName: '',
        lastName,
        email,
        department: 'Management Information Systems',
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    ok(snap.exists ? 'promoted existing profile to admin' : 'created admin profile');
    created++;
  }

  return uid;
}

async function ensureUnits(): Promise<void> {
  const existing = await adminDb.collection('units').limit(1).get();

  if (!existing.empty) {
    const all = await adminDb.collection('units').count().get();
    same(`units collection already has ${all.data().count} unit(s) — not touched`);
    skipped++;
    return;
  }

  const units = buildSeedUnits();
  // Firestore caps a batch at 500 writes; the seed is well under that, but the
  // chunking keeps this correct if the inventory grows later.
  for (let i = 0; i < units.length; i += 400) {
    const batch = adminDb.batch();
    for (const unit of units.slice(i, i + 400)) {
      batch.set(adminDb.collection('units').doc(), {
        ...unit,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  const prices = units.map((u) => u.price);
  ok(`seeded ${units.length} units`);
  ok(
    `price range PHP ${Math.min(...prices).toLocaleString()} - ${Math.max(...prices).toLocaleString()}`,
  );
  created++;
}

async function report(): Promise<void> {
  for (const name of ['users', 'units', 'reservations', 'documents', 'auditLogs']) {
    const count = (await adminDb.collection(name).count().get()).data().count;
    console.log(`  ${name.padEnd(14)} ${count}`);
  }
}

async function main() {
  if (!email || !password) {
    console.error(
      'Usage: npm run migrate -- <adminEmail> <adminPassword> [firstName] [lastName]\n' +
        '\nExample:\n  npm run migrate -- admin@sfsr.com Sup3rSecret',
    );
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  console.log(`\nSFSR-REMS migration -> project "${PROJECT_ID}"`);

  step(1, 'Connecting');
  // Forces a real round trip, so bad credentials fail here with a clear
  // message instead of halfway through writing data.
  await adminDb.collection('users').limit(1).get();
  ok('connected to Firestore');

  step(2, 'Administrator account');
  const uid = await ensureAdmin();

  step(3, 'Property inventory');
  await ensureUnits();

  step(4, 'Current contents');
  await report();

  console.log(
    `\nDone. ${created} change(s) applied, ${skipped} already in place.\n` +
      `\n  Admin uid:  ${uid}` +
      `\n  Sign in at: http://localhost:5174  (npm run dev:internal)\n`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('\n' + explainCredentialError(error));
  process.exit(1);
});
