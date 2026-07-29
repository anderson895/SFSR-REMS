/**
 * Measures how much of the unit inventory is duplicated data.
 *
 *   npm run inspect:shape -- <email> <password>
 *
 * Every field that is identical across all units of a project is a field that
 * belongs on the project, not on each unit.
 */

import { auth, db } from '../SFSR-Shared/src/index';
import {
  collection,
  getDocs,
  signInWithEmailAndPassword,
} from '../SFSR-Shared/src/sdk';

const [email, password] = process.argv.slice(2);

const bytes = (value: unknown) => JSON.stringify(value ?? null).length;

async function main() {
  if (email && password) await signInWithEmailAndPassword(auth, email, password);

  const snap = await getDocs(collection(db, 'units'));
  if (snap.empty) return console.log('No units.');

  const docs = snap.docs.map((d) => d.data());
  const fields = [...new Set(docs.flatMap((d) => Object.keys(d)))].sort();

  console.log(`\n${snap.size} unit documents\n`);
  console.log(
    'field'.padEnd(16) +
      'distinct'.padStart(9) +
      'bytes/doc'.padStart(11) +
      'total KB'.padStart(10) +
      '  verdict',
  );
  console.log('-'.repeat(66));

  let wastedTotal = 0;

  for (const field of fields) {
    const values = docs.map((d) => JSON.stringify(d[field] ?? null));
    const distinct = new Set(values).size;
    const perDoc = Math.round(
      values.reduce((n, v) => n + v.length, 0) / values.length,
    );
    const totalKb = (values.reduce((n, v) => n + v.length, 0) / 1024).toFixed(1);

    // A field with one distinct value across the whole collection is stored
    // hundreds of times to say the same thing once.
    const duplicated = distinct <= 3 && perDoc > 20;
    if (duplicated) wastedTotal += perDoc * (docs.length - distinct);

    console.log(
      field.padEnd(16) +
        String(distinct).padStart(9) +
        String(perDoc).padStart(11) +
        totalKb.padStart(10) +
        (duplicated ? '  <-- duplicated' : ''),
    );
  }

  const docSize = Math.round(docs.reduce((n, d) => n + bytes(d), 0) / docs.length);
  console.log(
    `\naverage document: ${docSize} bytes` +
      `\nduplicated payload: ~${Math.round(wastedTotal / 1024)} KB across the collection`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  });
