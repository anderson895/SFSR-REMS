/**
 * Copies the entire live project into the local emulator.
 *
 *   npm run clone:emulator
 *
 * Why this exists: `gcloud firestore export` needs a Cloud Storage bucket,
 * which requires the paid Blaze plan. On the free plan the only way to get a
 * real copy locally is to read the documents and write them again.
 *
 * The read side costs production quota ONCE. After that the emulator keeps
 * everything in .emulator-data/ and development is free forever.
 *
 * Every root collection is discovered automatically, so collections added later
 * are copied without touching this file.
 *
 * Nothing is written back to production. The emulator is the only write target.
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';

process.loadEnvFile('.env');

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'sfsr-rems';
const HOST = process.env.VITE_EMULATOR_HOST ?? '127.0.0.1';
const FIRESTORE_EMULATOR = `${HOST}:8080`;
const AUTH_EMULATOR = `${HOST}:9099`;

/** Password given to every cloned account, since real hashes cannot be copied. */
const DEV_PASSWORD = 'password123';

/**
 * Builds the two connections.
 *
 * Order matters. The Admin SDK decides whether an instance talks to the
 * emulator by reading FIRESTORE_EMULATOR_HOST at the moment `getFirestore` is
 * called, so production must be created while that variable is unset.
 */
function connect() {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

  const prodApp =
    getApps().find((a) => a.name === 'prod') ??
    initializeApp({ projectId: PROJECT_ID }, 'prod');
  const prodDb = getFirestore(prodApp);
  const prodAuth = getAuth(prodApp);

  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR;

  const emuApp =
    getApps().find((a) => a.name === 'emu') ??
    initializeApp({ projectId: PROJECT_ID }, 'emu');
  const emuDb = getFirestore(emuApp);
  const emuAuth = getAuth(emuApp);

  return { prodDb, prodAuth, emuDb, emuAuth };
}

async function copyCollections(prodDb: Firestore, emuDb: Firestore) {
  const collections = await prodDb.listCollections();

  if (collections.length === 0) {
    console.log('  (production has no collections)');
    return;
  }

  for (const ref of collections) {
    const snap = await ref.get();
    if (snap.empty) {
      console.log(`  ${ref.id.padEnd(18)} 0`);
      continue;
    }

    // Firestore caps a batch at 500 writes.
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = emuDb.batch();
      for (const d of snap.docs.slice(i, i + 400)) {
        batch.set(emuDb.collection(ref.id).doc(d.id), d.data());
      }
      await batch.commit();
    }

    console.log(`  ${ref.id.padEnd(18)} ${snap.size}`);
  }
}

async function copyUsers(
  prodAuth: ReturnType<typeof getAuth>,
  emuAuth: ReturnType<typeof getAuth>,
) {
  const { users } = await prodAuth.listUsers(1000);
  let copied = 0;

  for (const user of users) {
    try {
      // The UID is preserved deliberately: every users/{uid} document and every
      // reservation.buyerUid points at it, so a new UID would orphan the data
      // that was just copied.
      await emuAuth.createUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        password: DEV_PASSWORD,
      });
      copied++;
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/uid-already-exists') {
        await emuAuth.updateUser(user.uid, { password: DEV_PASSWORD });
        copied++;
      } else {
        console.log(`  skipped ${user.email}: ${(error as Error).message}`);
      }
    }
  }

  return { copied, total: users.length };
}

async function main() {
  console.log(`\nCloning "${PROJECT_ID}" into the local emulator\n`);

  const { prodDb, prodAuth, emuDb, emuAuth } = connect();

  // Fail early and clearly if the emulator is not running, rather than after
  // spending production reads.
  try {
    await emuDb.collection('__ping').limit(1).get();
  } catch {
    console.error(
      `Could not reach the Firestore emulator at ${FIRESTORE_EMULATOR}.\n` +
        'Start it first, in a separate terminal:\n\n  npm run emulators\n',
    );
    process.exit(1);
  }

  console.log('[1/2] Firestore documents');
  await copyCollections(prodDb, emuDb);

  console.log('\n[2/2] Authentication accounts');
  const { copied, total } = await copyUsers(prodAuth, emuAuth);
  console.log(`  ${copied} of ${total} account(s) copied`);

  console.log(
    `\nDone.\n` +
      `\n  Every cloned account now signs in with the password: ${DEV_PASSWORD}` +
      `\n  Emulator UI: http://${HOST}:4000` +
      `\n\nSet VITE_USE_EMULATOR=true in .env, then run npm run dev:portal.\n`,
  );
  process.exit(0);
}

main().catch((error) => {
  const message = (error as Error).message ?? String(error);

  if (
    message.includes('Could not load the default credentials') ||
    message.includes('UNAUTHENTICATED')
  ) {
    console.error(
      '\nNo Google credentials for reading the live project.\n' +
        '  gcloud auth application-default login\n' +
        `  gcloud auth application-default set-quota-project ${PROJECT_ID}\n`,
    );
  } else if (message.includes('RESOURCE_EXHAUSTED') || message.includes('Quota')) {
    console.error(
      '\nThe live project is over its daily read quota, so it cannot be copied ' +
        'right now.\nQuota resets at midnight US Pacific (about 3-4 PM Manila).\n' +
        '\nIn the meantime, seed a fresh emulator instead:\n' +
        '  npm run migrate:data -- admin@example.com password123\n',
    );
  } else {
    console.error('\n' + message);
  }
  process.exit(1);
});
