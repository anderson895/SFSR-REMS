/**
 * Creates the demo accounts used to exercise every role in the system.
 *
 *   npm run seed:accounts
 *
 * These exist because `firestore.rules` deliberately pins self-registration to
 * `buyer` — there is no supported way to click your way to a sales or
 * documentation account, which is the point. The Admin SDK creates them
 * directly instead of the rules being loosened to allow it.
 *
 * Idempotent, like the migration: re-running resets each password to the value
 * below and leaves everything else alone. Safe to run before a defense demo
 * when nobody remembers what the passwords were changed to.
 *
 * NOT for production. Every password here is public in the repository.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { PROJECT_ID, adminAuth, adminDb, explainCredentialError } from './adminApp';

interface TestAccount {
  email: string;
  password: string;
  role: 'admin' | 'sales' | 'documentation' | 'buyer';
  accountType: 'initial' | 'client';
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
  department?: string;
  /** Why this account exists, printed in the summary. */
  purpose: string;
}

const ACCOUNTS: TestAccount[] = [
  {
    email: 'admin@sfsr.test',
    password: 'Admin@2026',
    role: 'admin',
    accountType: 'initial',
    firstName: 'Ana',
    middleName: 'Bautista',
    lastName: 'Ramos',
    mobile: '09171234501',
    department: 'Management Information Systems',
    purpose: 'Full access — user management and audit trail',
  },
  {
    email: 'sales@sfsr.test',
    password: 'Sales@2026',
    role: 'sales',
    accountType: 'initial',
    firstName: 'Mark',
    middleName: 'Lucero',
    lastName: 'Villanueva',
    mobile: '09171234502',
    department: 'Sales and Marketing',
    purpose: 'Walk-in reservations, approve/reject reservations',
  },
  {
    email: 'docs@sfsr.test',
    password: 'Docs@2026',
    role: 'documentation',
    accountType: 'initial',
    firstName: 'Grace',
    middleName: 'Oliva',
    lastName: 'Mendoza',
    mobile: '09171234503',
    department: 'Documentation',
    purpose: 'Review uploaded documents and OCR validation results',
  },
  {
    // Named to match the manuscript's OCR worked example, so a test ID reading
    // "JUAN DELA CRVZ" lands in the tolerant MATCH band against this profile.
    email: 'juan.delacruz@sfsr.test',
    password: 'Buyer@2026',
    role: 'buyer',
    accountType: 'initial',
    firstName: 'Juan',
    middleName: 'Dela',
    lastName: 'Cruz',
    mobile: '09171234511',
    purpose: 'Primary buyer — use for the OCR name-matching demo',
  },
  {
    email: 'maria.santos@sfsr.test',
    password: 'Buyer@2026',
    role: 'buyer',
    accountType: 'initial',
    firstName: 'Maria',
    middleName: 'Reyes',
    lastName: 'Santos',
    mobile: '09171234512',
    purpose: 'Second buyer — reserve the same unit to show the on-hold guard',
  },
  {
    email: 'pedro.gonzales@sfsr.test',
    password: 'Buyer@2026',
    role: 'buyer',
    accountType: 'client',
    firstName: 'Pedro',
    middleName: 'Aquino',
    lastName: 'Gonzales',
    mobile: '09171234513',
    purpose: 'Already-converted client account (accountType: client)',
  },
];

async function ensureAccount(account: TestAccount): Promise<'created' | 'updated'> {
  let uid: string;
  let outcome: 'created' | 'updated';

  try {
    const existing = await adminAuth.getUserByEmail(account.email);
    uid = existing.uid;
    await adminAuth.updateUser(uid, { password: account.password });
    outcome = 'updated';
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    const created = await adminAuth.createUser({
      email: account.email,
      password: account.password,
      displayName: `${account.firstName} ${account.lastName}`,
    });
    uid = created.uid;
    outcome = 'created';
  }

  const { password: _password, purpose: _purpose, ...profile } = account;

  // merge:true so a profile edited during testing keeps its changes; only the
  // fields defined here are rewritten.
  await adminDb.collection('users').doc(uid).set(
    {
      ...profile,
      uid,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return outcome;
}

async function main() {
  console.log(`\nSFSR-REMS test accounts -> project "${PROJECT_ID}"\n`);

  let created = 0;
  let updated = 0;

  for (const account of ACCOUNTS) {
    const outcome = await ensureAccount(account);
    if (outcome === 'created') created++;
    else updated++;
    console.log(
      `  ${outcome === 'created' ? '+' : '='} ${account.role.padEnd(13)} ` +
        `${account.email.padEnd(26)} ${account.password}`,
    );
  }

  console.log(`\n${created} created, ${updated} already existed (password reset).`);
  console.log(
    '\n  Staff sign in at   http://localhost:5174   (npm run dev:internal)' +
      '\n  Buyers sign in at  http://localhost:5173   (npm run dev:portal)\n',
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('\n' + explainCredentialError(error));
  process.exit(1);
});
