/**
 * One-off inspection of the unit inventory shape.
 *
 *   npm run inspect:units -- <email> <password>
 *
 * Reports how many documents each page actually pulls, which is what drives
 * Firestore read cost far more than the size of the database.
 */

import { auth, db } from '../SFSR-Shared/src/index';
import {
  collection,
  getDocs,
  signInWithEmailAndPassword,
} from '../SFSR-Shared/src/sdk';

const [email, password] = process.argv.slice(2);

async function main() {
  if (email && password) await signInWithEmailAndPassword(auth, email, password);

  const snap = await getDocs(collection(db, 'units'));

  const byType = new Map<string, number>();
  const byBuilding = new Map<string, number>();
  const byStatus = new Map<string, number>();

  for (const d of snap.docs) {
    const u = d.data();
    byType.set(u.type, (byType.get(u.type) ?? 0) + 1);
    byBuilding.set(u.building, (byBuilding.get(u.building) ?? 0) + 1);
    byStatus.set(u.status, (byStatus.get(u.status) ?? 0) + 1);
  }

  console.log(`\nTotal units: ${snap.size}\n`);
  console.log('By type:', Object.fromEntries(byType));
  console.log('By building:', Object.fromEntries(byBuilding));
  console.log('By status:', Object.fromEntries(byStatus));
  console.log(
    `\nEvery listener attach on the public catalogue currently costs ` +
      `${snap.size} reads.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  });
