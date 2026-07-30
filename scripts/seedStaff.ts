/**
 * Creates the demo staff accounts for the Internal Management System.
 *
 *   npm run seed:staff                 the emulator, if VITE_USE_EMULATOR=true
 *   npm run seed:staff -- --live the live project
 *
 * One account per role, so the role-based access control can actually be
 * demonstrated rather than described: sign in as each and watch the navigation
 * and the permitted actions change.
 *
 * Idempotent. An existing account has its password reset and its profile
 * merged, so re-running fixes a forgotten password without creating duplicates.
 *
 * These are demo credentials with weak, published passwords. They belong in the
 * emulator; think before putting them anywhere real.
 */

import { FieldValue } from 'firebase-admin/firestore';
import {
  PROJECT_ID,
  USING_EMULATOR,
  adminAuth,
  adminDb,
  explainCredentialError,
} from './adminApp';

interface StaffSpec {
  email: string;
  password: string;
  role: 'admin' | 'sales' | 'documentation';
  firstName: string;
  middleName: string;
  lastName: string;
  department: string;
  /** What this role is for, printed as a reminder of what to demonstrate. */
  covers: string;
}

const STAFF: StaffSpec[] = [
  {
    email: 'admin@sfsr.test',
    password: 'Admin@2026',
    role: 'admin',
    firstName: 'Ana',
    middleName: 'Bautista',
    lastName: 'Ramos',
    department: 'Management Information Systems',
    covers: 'User management, audit trail, everything',
  },
  {
    email: 'sales@sfsr.test',
    password: 'Sales@2026',
    role: 'sales',
    firstName: 'Mark',
    middleName: 'Lucero',
    lastName: 'Villanueva',
    department: 'Sales',
    covers: 'Walk-in reservations, approve and reject',
  },
  {
    email: 'docs@sfsr.test',
    password: 'Docs@2026',
    role: 'documentation',
    firstName: 'Grace',
    middleName: 'Oliva',
    lastName: 'Mendoza',
    department: 'Documentation',
    covers: 'Document review and OCR validation',
  },
];

async function ensureStaff(spec: StaffSpec): Promise<string> {
  const displayName = `${spec.firstName} ${spec.lastName}`;
  let uid: string;
  let action: string;

  try {
    const existing = await adminAuth.getUserByEmail(spec.email);
    uid = existing.uid;
    await adminAuth.updateUser(uid, { password: spec.password, displayName });
    action = 'updated';
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    const created = await adminAuth.createUser({
      email: spec.email,
      password: spec.password,
      displayName,
    });
    uid = created.uid;
    action = 'created';
  }

  // merge:true so a name edited later in the app is not clobbered by a re-run.
  await adminDb
    .collection('users')
    .doc(uid)
    .set(
      {
        role: spec.role,
        accountType: 'initial',
        firstName: spec.firstName,
        middleName: spec.middleName,
        lastName: spec.lastName,
        email: spec.email,
        department: spec.department,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  console.log(
    `  ${action.padEnd(7)} ${spec.role.padEnd(14)} ${spec.email.padEnd(20)} ${displayName}`,
  );
  return uid;
}

async function main() {
  console.log(
    `\nSeeding staff accounts -> "${PROJECT_ID}"` +
      `  [${USING_EMULATOR ? 'LOCAL EMULATOR' : 'LIVE PROJECT'}]\n`,
  );

  if (!USING_EMULATOR) {
    console.log(
      '  NOTE: these are demo passwords and this is the live project.\n' +
        '  Change them in the Firebase Console once the demo is over.\n',
    );
  }

  for (const spec of STAFF) await ensureStaff(spec);

  // Read back rather than trust the writes.
  const check = await adminDb
    .collection('users')
    .where('role', 'in', ['admin', 'sales', 'documentation'])
    .get();

  console.log(`\nStaff accounts now in the database: ${check.size}`);
  for (const spec of STAFF) {
    console.log(`  ${spec.email.padEnd(20)} ${spec.password.padEnd(12)} ${spec.covers}`);
  }
  console.log('\nSign in at http://localhost:5174\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n' + explainCredentialError(error));
    process.exit(1);
  });
