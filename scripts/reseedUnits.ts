/**
 * Replaces the entire unit inventory with what `unitData.ts` currently defines.
 *
 *   npx tsx scripts/reseedUnits.ts --yes
 *
 * Invoked directly rather than through `npm run`, because npm on Windows
 * PowerShell drops the `--` separator and the flag never reaches this script —
 * it silently reports "nothing was changed" instead of doing the work.
 *
 * This exists because `migrate.ts` refuses to touch a non-empty units
 * collection, and that refusal is correct — a migration that can wipe data is
 * one typo away from destroying a defense demo. So the destructive path is not
 * hidden behind a flag on the safe script; it is this separate file, which you
 * have to name deliberately and confirm with --yes.
 *
 * Refuses to run when the inventory is in use. A unit that is on hold, sold, or
 * pointed at by a reservation cannot be deleted without leaving a reservation
 * referencing a unitId that no longer exists, so the guard is a correctness
 * check, not just caution. `--force` overrides it and says plainly what will
 * break.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { PROJECT_ID, adminDb, explainCredentialError } from './adminApp';
import { buildSeedUnits } from './unitData';

/** Firestore caps a batch at 500 operations. */
const BATCH_LIMIT = 400;

const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const force = args.includes('--force');

async function checkSafeToDelete(): Promise<string[]> {
  const problems: string[] = [];

  const units = await adminDb.collection('units').get();
  const inUse = units.docs.filter((doc) => {
    const unit = doc.data();
    return unit.status !== 'available' || unit.heldBy !== null;
  });

  if (inUse.length > 0) {
    problems.push(
      `${inUse.length} unit(s) are not free: ` +
        inUse
          .slice(0, 5)
          .map((d) => `${d.data().unitNo} (${d.data().status})`)
          .join(', ') +
        (inUse.length > 5 ? ', …' : ''),
    );
  }

  const reservations = await adminDb.collection('reservations').limit(1).get();
  if (!reservations.empty) {
    const count = (await adminDb.collection('reservations').count().get()).data()
      .count;
    problems.push(
      `${count} reservation(s) exist and reference unit IDs that this would delete`,
    );
  }

  return problems;
}

async function deleteAll(): Promise<number> {
  let deleted = 0;

  // Re-queried each pass rather than paged, because deleting as you page skips
  // documents: removing a doc shifts everything after it back by one.
  for (;;) {
    const page = await adminDb.collection('units').limit(BATCH_LIMIT).get();
    if (page.empty) break;

    const batch = adminDb.batch();
    for (const doc of page.docs) batch.delete(doc.ref);
    await batch.commit();

    deleted += page.size;
    console.log(`  - deleted ${deleted}`);
  }

  return deleted;
}

async function writeSeed(): Promise<number> {
  const units = buildSeedUnits();

  for (let i = 0; i < units.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    for (const unit of units.slice(i, i + BATCH_LIMIT)) {
      batch.set(adminDb.collection('units').doc(), {
        ...unit,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log(`  + wrote ${Math.min(i + BATCH_LIMIT, units.length)}`);
  }

  return units.length;
}

async function main() {
  console.log(`\nReseed unit inventory -> project "${PROJECT_ID}"\n`);

  const existing = (await adminDb.collection('units').count().get()).data().count;
  const incoming = buildSeedUnits();

  console.log(`  current inventory:  ${existing} unit(s)`);
  console.log(`  will be replaced by: ${incoming.length} unit(s)`);

  const projects = [...new Set(incoming.map((u) => u.projectName))];
  console.log(`  projects: ${projects.join(', ')}\n`);

  const problems = await checkSafeToDelete();

  if (problems.length > 0) {
    for (const problem of problems) console.log(`  ! ${problem}`);

    if (!force) {
      console.error(
        '\nRefusing to delete an inventory that is in use.\n' +
          'Cancel the reservations first, or pass --force to delete anyway ' +
          '(this WILL leave those reservations pointing at missing units).',
      );
      process.exit(1);
    }
    console.log('\n  --force given; deleting anyway.');
  }

  if (!confirmed) {
    console.error(
      '\nNothing was changed. Re-run with --yes to replace the inventory:\n' +
        '  npx tsx scripts/reseedUnits.ts --yes',
    );
    process.exit(1);
  }

  console.log('Deleting current inventory…');
  const deleted = await deleteAll();

  console.log('\nWriting new inventory…');
  const written = await writeSeed();

  const prices = incoming.map((u) => u.price);
  console.log(
    `\nReplaced ${deleted} unit(s) with ${written}.` +
      `\n  price range: PHP ${Math.min(...prices).toLocaleString()} - ${Math.max(...prices).toLocaleString()}\n`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('\n' + explainCredentialError(error));
  process.exit(1);
});
