/**
 * Seeds demo inventory using an ordinary staff sign-in.
 *
 * This is the alternative to `npm run migrate` for anyone who does not want to
 * set up Google admin credentials. It writes through the normal client SDK, so
 * every write is checked by the same `firestore.rules` the apps run under —
 * which also makes it a genuine test that the rules permit what staff need.
 *
 * Requires an existing staff account, so it cannot create the first admin.
 * Use `npm run migrate` for that.
 *
 * Usage:
 *   npm run seed -- <adminEmail> <password>
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { buildSeedCatalogue } from './unitData';

// Node 22 can read a .env file without any dependency.
process.loadEnvFile('.env');

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: npm run seed -- <adminEmail> <password>');
  process.exit(1);
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.VITE_FIREBASE_APP_ID!,
});

const db = getFirestore(app);

async function main() {
  const auth = getAuth(app);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${credential.user.email}`);

  const unitsRef = collection(db, 'units');
  const existing = await getDocs(unitsRef);

  if (!existing.empty) {
    console.log(
      `\n${existing.size} unit(s) already exist. Nothing was written.\n` +
        'Delete the units collection in the Firebase Console first if you want to re-seed.',
    );
    process.exit(0);
  }

  const { projects, unitTypes, units } = buildSeedCatalogue();
  const stamp = {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const metaBatch = writeBatch(db);
  for (const { id, ...project } of projects) {
    metaBatch.set(doc(db, 'projects', id), { ...project, ...stamp });
  }
  for (const { id, ...type } of unitTypes) {
    metaBatch.set(doc(db, 'unitTypes', id), { ...type, ...stamp });
  }
  await metaBatch.commit();

  // The client SDK caps a batch at 500 writes, and the inventory now exceeds
  // that, so the units are committed in chunks.
  for (let i = 0; i < units.length; i += 400) {
    const batch = writeBatch(db);
    for (const unit of units.slice(i, i + 400)) {
      batch.set(doc(unitsRef), { ...unit, ...stamp });
    }
    await batch.commit();
  }

  const prices = units.map((u) => u.price);
  console.log(
    `\nSeeded ${projects.length} project(s), ${unitTypes.length} unit type(s), ${units.length} units.`,
  );
  console.log(
    `  price range: PHP ${Math.min(...prices).toLocaleString()} - ${Math.max(...prices).toLocaleString()}`,
  );
  process.exit(0);
}

main().catch((error) => {
  const code = (error as { code?: string }).code ?? '';
  if (code === 'permission-denied') {
    console.error(
      '\nPermission denied writing units.\n' +
        'That account is not staff. Run `npm run migrate` first to create an admin.',
    );
  } else {
    console.error('\n' + ((error as Error).message ?? String(error)));
  }
  process.exit(1);
});
