/**
 * Finds and releases units held by a reservation that no longer exists.
 *
 *   npx tsx scripts/releaseOrphanHolds.ts          # report only
 *   npx tsx scripts/releaseOrphanHolds.ts --fix    # release them
 *
 * A unit whose `heldBy` points at a deleted reservation is stuck: the rule
 * that lets a buyer release their own hold reads that reservation to check
 * ownership, and a missing document means the check can never pass. The unit
 * stays off the market with nobody able to free it, which is why this needs
 * privileged credentials to repair.
 *
 * Only ever touches units that are genuinely orphaned — a hold backed by a
 * real reservation is left alone, whatever state that reservation is in.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { PROJECT_ID, adminDb, explainCredentialError } from './adminApp';

const fix = process.argv.slice(2).includes('--fix');

async function main() {
  console.log(`\nOrphaned holds -> project "${PROJECT_ID}"\n`);

  const held = await adminDb
    .collection('units')
    .where('status', '==', 'on_hold')
    .get();

  console.log(`  ${held.size} unit(s) currently on hold\n`);

  const orphans: { id: string; unitNo: string; heldBy: string | null }[] = [];

  for (const unitDoc of held.docs) {
    const unit = unitDoc.data();
    const heldBy: string | null = unit.heldBy ?? null;

    const reservationExists =
      heldBy !== null &&
      (await adminDb.collection('reservations').doc(heldBy).get()).exists;

    if (reservationExists) {
      console.log(`  ok      unit ${unit.unitNo} -> reservation ${heldBy}`);
    } else {
      console.log(
        `  ORPHAN  unit ${unit.unitNo} -> ${heldBy ?? '(no heldBy)'} (missing)`,
      );
      orphans.push({ id: unitDoc.id, unitNo: unit.unitNo, heldBy });
    }
  }

  if (orphans.length === 0) {
    console.log('\nNo orphaned holds. Nothing to do.\n');
    process.exit(0);
  }

  if (!fix) {
    console.log(
      `\n${orphans.length} orphaned hold(s) found. Nothing was changed.` +
        '\nRe-run with --fix to return them to the market.\n',
    );
    process.exit(0);
  }

  for (const orphan of orphans) {
    await adminDb.collection('units').doc(orphan.id).update({
      status: 'available',
      heldBy: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`  + released unit ${orphan.unitNo}`);
  }

  const available = await adminDb
    .collection('units')
    .where('status', '==', 'available')
    .count()
    .get();

  console.log(
    `\nReleased ${orphans.length} unit(s).` +
      `\n  now available: ${available.data().count}\n`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('\n' + explainCredentialError(error));
  process.exit(1);
});
