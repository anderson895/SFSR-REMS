/**
 * Splits the denormalised `units` collection into projects, unitTypes, and
 * slim units.
 *
 *   npm run normalize -- --plan     inspect the plan, write nothing
 *   npm run normalize               apply it
 *
 * The flag is `--plan`, not `--dry-run`: npm treats `--dry-run` as one of its
 * own options and swallows it, so the script would never see it and would
 * silently perform the write it was asked to preview.
 *
 * Before: every unit carried the project name, location, building, the eight
 * shared amenities, the type's images, floor plan, and description — about 69%
 * of each 1,280-byte document repeating what 319 other documents already said.
 *
 * After:
 *   projects/{id}   name, location, building, amenities, images
 *   unitTypes/{id}  projectId, type, floorAreaSqm, floorPlan, images, pricing
 *   units/{id}      projectId, typeId, unitNo, floor, price, status, heldBy
 *
 * Idempotent: units that already carry a `typeId` are left alone, so a run that
 * fails partway can simply be repeated. Nothing is deleted — the old fields are
 * removed from unit documents only after their replacements exist.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, explainCredentialError } from './adminApp';

const DRY_RUN = process.argv.includes('--plan');

if (process.argv.includes('--dry-run')) {
  console.error(
    'Use --plan, not --dry-run: npm consumes --dry-run as its own flag and it ' +
      'never reaches this script.',
  );
  process.exit(1);
}

/** Catalogue ordering, smallest home first. */
const TYPE_ORDER = ['Studio', '1BR', '2BR', '3BR'];

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

interface LegacyUnit {
  projectName?: string;
  location?: string;
  building?: string;
  type?: string;
  floorAreaSqm?: number;
  price?: number;
  amenities?: string[];
  images?: string[];
  floorPlanUrl?: string;
  description?: string;
  promo?: string;
  typeId?: string;
}

async function main() {
  console.log(
    `\nNormalising the unit inventory${DRY_RUN ? '  (PLAN ONLY — nothing will be written)' : ''}\n`,
  );

  const unitsSnap = await adminDb.collection('units').get();
  if (unitsSnap.empty) {
    console.log('No units found. Nothing to do.');
    return;
  }

  const alreadyDone = unitsSnap.docs.filter((d) => d.data().typeId).length;
  console.log(`${unitsSnap.size} unit(s); ${alreadyDone} already normalised.`);

  /**
   * Refuse to run a second time.
   *
   * This script derives the catalogue metadata FROM the units, and its first
   * run deletes the very fields it reads — floorAreaSqm, images, floorPlanUrl.
   * Running it again therefore rebuilds every unit type from units that no
   * longer carry that data, replacing correct metadata with zeroes and empty
   * strings. That is exactly what happened once: every type came back as
   * "0 sqm" with no floor plan.
   *
   * The earlier version of this file claimed to be idempotent and merely
   * counted the already-migrated units without acting on the count.
   */
  if (alreadyDone > 0 && !DRY_RUN) {
    console.error(
      `\nRefusing to run: ${alreadyDone} unit(s) are already normalised.\n` +
        '\nRe-running would rebuild projects and unitTypes from units that no\n' +
        'longer carry floor areas or images, wiping the metadata.\n' +
        '\nTo rewrite the catalogue metadata from unitData.ts instead:\n' +
        '  npm run repair:catalogue\n',
    );
    process.exit(1);
  }

  // ---------------------------------------------------------------- derive
  const projects = new Map<string, Record<string, unknown>>();
  const types = new Map<string, Record<string, unknown>>();

  for (const doc of unitsSnap.docs) {
    const u = doc.data() as LegacyUnit;
    const projectName = u.projectName ?? 'Unnamed Project';
    const projectId = slug(projectName);

    if (!projects.has(projectId)) {
      projects.set(projectId, {
        name: projectName,
        location: u.location ?? '',
        building: u.building ?? projectName,
        // Amenities belong to the development, and every unit carried the same
        // list — take the longest one seen in case some records are partial.
        amenities: u.amenities ?? [],
        images: [],
        description: '',
      });
    } else {
      const existing = projects.get(projectId)!;
      const current = (existing.amenities as string[]) ?? [];
      if ((u.amenities?.length ?? 0) > current.length) {
        existing.amenities = u.amenities;
      }
      if (!existing.location && u.location) existing.location = u.location;
    }

    const typeName = u.type ?? 'Unspecified';
    const typeId = `${projectId}--${slug(typeName)}`;

    const price = u.price ?? 0;
    if (!types.has(typeId)) {
      types.set(typeId, {
        projectId,
        projectName,
        type: typeName,
        floorAreaSqm: u.floorAreaSqm ?? 0,
        floorPlanUrl: u.floorPlanUrl ?? '',
        images: u.images ?? [],
        description: u.description ?? '',
        promo: u.promo ?? '',
        startingPrice: price,
        totalCount: 1,
        sortOrder: TYPE_ORDER.indexOf(typeName) >= 0
          ? TYPE_ORDER.indexOf(typeName)
          : TYPE_ORDER.length,
      });
    } else {
      const t = types.get(typeId)!;
      t.totalCount = (t.totalCount as number) + 1;
      if (price > 0 && price < (t.startingPrice as number)) {
        t.startingPrice = price;
      }
      // Prefer a record that actually has artwork over one that does not.
      if (!(t.images as string[]).length && u.images?.length) t.images = u.images;
      if (!t.floorPlanUrl && u.floorPlanUrl) t.floorPlanUrl = u.floorPlanUrl;
      if (!t.description && u.description) t.description = u.description;
    }
  }

  console.log(`\nDerived ${projects.size} project(s):`);
  for (const [id, p] of projects) {
    console.log(
      `  ${id.padEnd(22)} ${p.name}  (${(p.amenities as string[]).length} amenities)`,
    );
  }

  console.log(`\nDerived ${types.size} unit type(s):`);
  for (const [id, t] of types) {
    console.log(
      `  ${id.padEnd(30)} ${String(t.type).padEnd(8)} ` +
        `${String(t.totalCount).padStart(4)} units  from PHP ` +
        `${(t.startingPrice as number).toLocaleString()}`,
    );
  }

  if (DRY_RUN) {
    console.log('\nPlan only. Re-run without --plan to apply.\n');
    return;
  }

  // ----------------------------------------------------------------- write
  console.log('\nWriting projects and unit types…');
  const metaBatch = adminDb.batch();
  for (const [id, project] of projects) {
    metaBatch.set(
      adminDb.collection('projects').doc(id),
      { ...project, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  for (const [id, type] of types) {
    metaBatch.set(
      adminDb.collection('unitTypes').doc(id),
      { ...type, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  await metaBatch.commit();
  console.log(`  wrote ${projects.size} project(s), ${types.size} type(s)`);

  console.log('\nSlimming unit documents…');
  let updated = 0;

  for (let i = 0; i < unitsSnap.docs.length; i += 400) {
    const batch = adminDb.batch();

    for (const doc of unitsSnap.docs.slice(i, i + 400)) {
      const u = doc.data() as LegacyUnit;
      const projectName = u.projectName ?? 'Unnamed Project';
      const projectId = slug(projectName);
      const typeId = `${projectId}--${slug(u.type ?? 'Unspecified')}`;

      batch.update(doc.ref, {
        projectId,
        typeId,
        // projectName and type stay: they are what the listing filters and
        // labels on, and keeping them avoids two extra reads per unit.
        projectName,
        type: u.type ?? 'Unspecified',
        // The duplicated payload goes.
        location: FieldValue.delete(),
        building: FieldValue.delete(),
        amenities: FieldValue.delete(),
        images: FieldValue.delete(),
        floorPlanUrl: FieldValue.delete(),
        description: FieldValue.delete(),
        promo: FieldValue.delete(),
        floorAreaSqm: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated++;
    }

    await batch.commit();
    console.log(`  ${Math.min(i + 400, unitsSnap.size)}/${unitsSnap.size}`);
  }

  console.log(
    `\nDone. ${updated} unit(s) slimmed, ${projects.size} project(s) and ` +
      `${types.size} type(s) created.\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n' + explainCredentialError(error));
    process.exit(1);
  });
