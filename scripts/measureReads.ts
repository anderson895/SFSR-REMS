/**
 * Counts the Firestore document reads each screen actually costs.
 *
 *   npm run measure -- <email> <password>
 *
 * Runs the same queries the pages run, through the same client SDK, and reports
 * how many documents come back. Firestore bills one read per document returned,
 * plus one read per 1,000 documents matched by an aggregation query — so these
 * counts are the bill.
 *
 * Written because "it should be fine now" is not a number, and this project has
 * already exhausted a day's free quota once.
 */

import {
  COLLECTIONS,
  UnitStatus,
  auth,
  db,
} from '../SFSR-Shared/src/index';
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  signInWithEmailAndPassword,
  where,
} from '../SFSR-Shared/src/sdk';

const [email, password] = process.argv.slice(2);

/** Free Spark allowance. */
const DAILY_READS = 50_000;

const BROWSABLE = [UnitStatus.AVAILABLE, UnitStatus.ON_HOLD];

interface Measurement {
  screen: string;
  reads: number;
  detail: string;
}

const results: Measurement[] = [];

/** An aggregation query bills 1 read per 1,000 documents matched. */
const aggregationCost = (matched: number) => Math.max(1, Math.ceil(matched / 1000));

async function main() {
  if (email && password) await signInWithEmailAndPassword(auth, email, password);

  // ---------------------------------------------------------------- home
  const types = await getDocs(collection(db, COLLECTIONS.UNIT_TYPES));
  const projects = await getDocs(collection(db, COLLECTIONS.PROJECTS));

  let typeCountCost = 0;
  for (const t of types.docs) {
    const snap = await getCountFromServer(
      query(
        collection(db, COLLECTIONS.UNITS),
        where('typeId', '==', t.id),
        where('status', '==', UnitStatus.AVAILABLE),
      ),
    );
    typeCountCost += aggregationCost(snap.data().count);
  }

  results.push({
    screen: 'Home page',
    reads: types.size + projects.size + typeCountCost,
    detail: `${types.size} types + ${projects.size} project + ${typeCountCost} count queries`,
  });

  results.push({
    screen: 'Units — browsing',
    reads: types.size + typeCountCost,
    detail: `${types.size} type documents + ${typeCountCost} count queries`,
  });

  // ------------------------------------------------- open one unit type
  const firstType = types.docs[0];
  if (firstType) {
    const ofType = await getDocs(
      query(
        collection(db, COLLECTIONS.UNITS),
        where('typeId', '==', firstType.id),
        where('status', 'in', BROWSABLE),
        orderBy('floor'),
        limit(60),
      ),
    );
    results.push({
      screen: 'Units — open a type',
      reads: ofType.size,
      detail: `first page of ${firstType.data().type}, capped at 60`,
    });
  }

  results.push({
    screen: 'Unit detail',
    reads: 3,
    detail: '1 unit + 1 project + 1 unit type',
  });

  // ------------------------------------------------------------ search
  const search = await getDocs(
    query(
      collection(db, COLLECTIONS.UNITS),
      where('status', 'in', BROWSABLE),
      orderBy('price'),
      limit(48),
    ),
  );
  results.push({
    screen: 'Units — search (only if used)',
    reads: search.size + 1,
    detail: 'capped at 48, plus one total count',
  });

  // ------------------------------------------------------------- staff
  const reservations = await getDocs(
    query(
      collection(db, COLLECTIONS.RESERVATIONS),
      orderBy('createdAt', 'desc'),
      limit(200),
    ),
  );
  results.push({
    screen: 'Staff — reservation queue',
    reads: reservations.size,
    detail: 'capped at 200',
  });

  const audit = await getDocs(
    query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy('at', 'desc'), limit(50)),
  );
  results.push({
    screen: 'Staff — audit trail',
    reads: audit.size,
    detail: 'capped at 50, fetched on open and on Refresh only',
  });

  // ----------------------------------------------------------- report
  console.log('\nFirestore reads per screen\n');
  console.log('screen'.padEnd(32) + 'reads'.padStart(6) + '   detail');
  console.log('-'.repeat(78));
  for (const r of results) {
    console.log(
      r.screen.padEnd(32) + String(r.reads).padStart(6) + '   ' + r.detail,
    );
  }

  // A visitor who lands, browses, opens a type, and views two units.
  const visitor =
    (results.find((r) => r.screen === 'Home page')?.reads ?? 0) +
    (results.find((r) => r.screen === 'Units — browsing')?.reads ?? 0) +
    (results.find((r) => r.screen === 'Units — open a type')?.reads ?? 0) +
    3 * 2;

  console.log(
    `\nA thorough visitor (home, browse, open a type, view two units): ` +
      `~${visitor} reads`,
  );
  console.log(
    `Free tier is ${DAILY_READS.toLocaleString()} reads/day ` +
      `=> about ${Math.floor(DAILY_READS / visitor).toLocaleString()} such visits a day.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  });
