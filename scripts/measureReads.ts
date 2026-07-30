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
  CATALOGUE_PAGE_SIZE,
  COLLECTIONS,
  FLOOR_PAGE_SIZE,
  MAX_AUDIT_ENTRIES,
  MAX_RESERVATIONS,
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

/** Records a measurement and hands it back, so totals reference it directly. */
function record(m: Measurement): Measurement {
  results.push(m);
  return m;
}

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

  const home = record({
    screen: 'Home page',
    reads: types.size + projects.size + typeCountCost,
    detail: `${types.size} types + ${projects.size} project + ${typeCountCost} count queries`,
  });

  const browsing = record({
    screen: 'Units - browsing',
    reads: types.size + typeCountCost,
    detail: `${types.size} type documents + ${typeCountCost} count queries`,
  });

  // ------------------------------------------------- open one unit type
  let openType: Measurement | undefined;
  const firstType = types.docs[0];
  if (firstType) {
    const ofType = await getDocs(
      query(
        collection(db, COLLECTIONS.UNITS),
        where('typeId', '==', firstType.id),
        where('status', 'in', BROWSABLE),
        orderBy('floor'),
        limit(FLOOR_PAGE_SIZE),
      ),
    );
    openType = record({
      screen: 'Units - open a type',
      reads: ofType.size,
      detail: `first page of ${firstType.data().type}, capped at ${FLOOR_PAGE_SIZE}`,
    });
  }

  const unitDetail = record({
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
      limit(CATALOGUE_PAGE_SIZE),
    ),
  );
  record({
    screen: 'Units - search (only if used)',
    reads: search.size + 1,
    detail: `capped at ${CATALOGUE_PAGE_SIZE}, plus one total count`,
  });

  // ------------------------------------------------- staff walk-in form
  //
  // Previously a single dropdown of every available unit: 317 reads to fill one
  // control. Now it narrows by type, then floor.
  if (firstType) {
    const t = firstType.data();
    const onFloor = await getDocs(
      query(
        collection(db, COLLECTIONS.UNITS),
        where('typeId', '==', firstType.id),
        where('status', '==', UnitStatus.AVAILABLE),
        where('floor', '==', t.lowestFloor ?? 2),
        limit(20),
      ),
    );
    record({
      screen: 'Staff - walk-in unit picker',
      reads: types.size + onFloor.size,
      detail: `${types.size} types + ${onFloor.size} units on one floor`,
    });
  }

  // ------------------------------------------------------------- staff
  const reservations = await getDocs(
    query(
      collection(db, COLLECTIONS.RESERVATIONS),
      orderBy('createdAt', 'desc'),
      limit(MAX_RESERVATIONS),
    ),
  );
  record({
    screen: 'Staff - reservation queue',
    reads: reservations.size,
    detail: `capped at ${MAX_RESERVATIONS}`,
  });

  const audit = await getDocs(
    query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy('at', 'desc'), limit(MAX_AUDIT_ENTRIES)),
  );
  record({
    screen: 'Staff - audit trail',
    reads: audit.size,
    detail: `capped at ${MAX_AUDIT_ENTRIES}, fetched on open and on Refresh only`,
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

  /**
   * A visitor who lands, browses, opens a type, and views two units.
   *
   * Summed from the recorded measurements rather than looked up by their display
   * strings. The lookup silently returned 0 the moment one label's dash changed
   * from an em-dash to a hyphen, and an undercount here is worse than no count.
   */
  const visitor =
    home.reads + browsing.reads + (openType?.reads ?? 0) + unitDetail.reads * 2;

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
