/**
 * Runs the exact queries the two apps run, and reports what comes back.
 *
 *   npm run diagnose -- <email> <password>
 *
 * Useful when a screen renders but shows nothing: it separates "the query is
 * wrong", "the data is wrong", and "the rules said no", which all look
 * identical in the UI.
 */

import { UnitStatus, auth, db } from '../SFSR-Shared/src/index';
import {
  collection,
  getDocs,
  orderBy,
  query,
  signInWithEmailAndPassword,
  where,
} from '../SFSR-Shared/src/sdk';

const [email, password] = process.argv.slice(2);

async function main() {
  if (email && password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`Signed in as ${cred.user.email}\n`);
  } else {
    console.log('Not signed in (testing anonymous access)\n');
  }

  // 1. Everything in the collection, no filters.
  const all = await getDocs(collection(db, 'units'));
  console.log(`units collection: ${all.size} document(s)`);

  const statuses: Record<string, number> = {};
  const priceTypes: Record<string, number> = {};
  for (const d of all.docs) {
    const data = d.data();
    const s = String(data.status);
    statuses[s] = (statuses[s] ?? 0) + 1;
    const t = typeof data.price;
    priceTypes[t] = (priceTypes[t] ?? 0) + 1;
  }
  console.log('  status values:', statuses);
  console.log('  price field types:', priceTypes);

  if (all.size) {
    const sample = all.docs[0].data();
    console.log('\n  sample document:');
    for (const key of ['building', 'unitNo', 'status', 'price', 'heldBy']) {
      console.log(`    ${key.padEnd(9)} ${JSON.stringify(sample[key])}`);
    }
  }

  // 2. The filter alone.
  const filtered = await getDocs(
    query(collection(db, 'units'), where('status', '==', UnitStatus.AVAILABLE)),
  );
  console.log(
    `\nwhere status == "${UnitStatus.AVAILABLE}": ${filtered.size} document(s)`,
  );

  // 3. The exact query behind the walk-in dropdown and the portal listing.
  try {
    const exact = await getDocs(
      query(
        collection(db, 'units'),
        where('status', '==', UnitStatus.AVAILABLE),
        orderBy('price'),
      ),
    );
    console.log(`filter + orderBy("price"): ${exact.size} document(s)`);
  } catch (error) {
    console.log(`filter + orderBy("price"): FAILED -> ${(error as Error).message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n' + (error as Error).message);
    process.exit(1);
  });
