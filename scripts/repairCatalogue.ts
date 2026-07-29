/**
 * Rewrites `projects` and `unitTypes` from `unitData.ts`.
 *
 *   npm run repair:catalogue
 *
 * `unitData.ts` is the authoritative description of the inventory — floor
 * areas, floor plans, renders, and descriptions are transcribed there from the
 * approved plan sheets. This script pushes that description into Firestore
 * without touching a single unit document.
 *
 * Needed because `normalizeUnits.ts` derived the catalogue metadata *from the
 * units*, and its first run deletes the very fields it reads. Running it twice
 * therefore replaced good metadata with empty values: every type came back as
 * "0 sqm" with no floor plan. This script is the repair, and is safe to run at
 * any time because it reads from source rather than from the database.
 *
 * Units are never modified: their prices and statuses are live business data
 * and are not this script's to touch.
 */

import { FieldValue } from 'firebase-admin/firestore';
import {
  PROJECT_ID,
  USING_EMULATOR,
  adminDb,
  explainCredentialError,
} from './adminApp';
import { buildSeedCatalogue } from './unitData';

async function main() {
  console.log(
    `\nRepairing catalogue metadata -> "${PROJECT_ID}"` +
      `  [${USING_EMULATOR ? 'LOCAL EMULATOR' : 'LIVE PROJECT'}]\n`,
  );

  const { projects, unitTypes } = buildSeedCatalogue();
  const stamp = { updatedAt: FieldValue.serverTimestamp() };

  const batch = adminDb.batch();

  for (const { id, ...project } of projects) {
    batch.set(adminDb.collection('projects').doc(id), { ...project, ...stamp }, {
      merge: true,
    });
    console.log(
      `  project   ${id.padEnd(24)} ${project.amenities.length} amenities`,
    );
  }

  for (const { id, ...type } of unitTypes) {
    batch.set(adminDb.collection('unitTypes').doc(id), { ...type, ...stamp }, {
      merge: true,
    });
    console.log(
      `  type      ${id.padEnd(24)} ${String(type.type).padEnd(7)} ` +
        `${String(type.floorAreaSqm).padStart(3)} sqm  ` +
        `${type.floorPlanUrl ? 'floor plan ok' : 'NO FLOOR PLAN'}`,
    );
  }

  await batch.commit();

  // Read back rather than trust the write: this script exists precisely because
  // metadata was silently wrong, and a claim of success is worth less than a
  // check.
  const check = await adminDb.collection('unitTypes').get();
  const broken = check.docs.filter((d) => !d.data().floorAreaSqm);

  console.log(
    `\nWrote ${projects.length} project(s) and ${unitTypes.length} type(s).`,
  );
  console.log(
    broken.length === 0
      ? 'Verified: every unit type has a floor area.\n'
      : `WARNING: ${broken.length} type(s) still have no floor area.\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n' + explainCredentialError(error));
    process.exit(1);
  });
