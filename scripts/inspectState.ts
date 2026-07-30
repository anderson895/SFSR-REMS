/**
 * Prints the current reservation / document / hold state.
 *
 *   npm run inspect:state
 *   npm run inspect:state -- --live
 *
 * Read-only. Useful after a manual run through the portal to confirm what the
 * flow actually wrote, rather than what it appeared to do on screen.
 */

import { PROJECT_ID, USING_EMULATOR, adminDb } from './adminApp';

async function main() {
  console.log(
    `\n"${PROJECT_ID}"  [${USING_EMULATOR ? 'LOCAL EMULATOR' : 'LIVE PROJECT'}]`,
  );

  /**
   * Catalogue health.
   *
   * Checked first because the failure is silent: a unit type missing its floor
   * area renders as "0 sqm" with a blank card rather than an error, which is
   * exactly how it went unnoticed once before.
   */
  const types = await adminDb.collection('unitTypes').get();
  console.log(`\nunit types: ${types.size}`);
  let incomplete = 0;
  for (const doc of types.docs) {
    const t = doc.data();
    const missing = [
      t.floorAreaSqm ? null : 'floorAreaSqm',
      t.floorPlanUrl ? null : 'floorPlanUrl',
      t.endingPrice ? null : 'endingPrice',
    ].filter(Boolean);
    if (missing.length) incomplete++;
    console.log(
      `  ${String(t.type).padEnd(8)} ${String(t.floorAreaSqm ?? 0).padStart(3)} sqm  ` +
        `total=${String(t.totalCount ?? '?').padStart(4)}  ` +
        (missing.length ? `MISSING: ${missing.join(', ')}` : 'complete'),
    );
  }
  if (incomplete > 0) {
    console.log(
      `  -> ${incomplete} incomplete. Fix with: npm run repair:catalogue` +
        `${USING_EMULATOR ? '' : ' -- --live'}`,
    );
  }

  const documents = await adminDb.collection('documents').get();

  const perReservation = new Map<string, number>();
  for (const doc of documents.docs) {
    const id = doc.data().reservationId as string;
    perReservation.set(id, (perReservation.get(id) ?? 0) + 1);
  }

  const reservations = await adminDb.collection('reservations').get();
  console.log(`\nreservations: ${reservations.size}`);
  for (const doc of reservations.docs) {
    const r = doc.data();
    const count = perReservation.get(doc.id) ?? 0;
    console.log(
      `  ${doc.id.slice(0, 8)}  ${r.unitLabel}  [${r.status}]  ` +
        `${r.buyer?.firstName ?? '?'} ${r.buyer?.lastName ?? ''}  ` +
        `docs=${count}${count === 0 ? '  <-- NO DOCUMENTS' : ''}`,
    );
  }

  console.log(`\ndocuments: ${documents.size}`);
  let scanned = 0;
  for (const doc of documents.docs) {
    const d = doc.data();
    // Character count and confidence are the evidence that OCR genuinely ran in
    // a browser on a real image, rather than the record merely existing. It is
    // the one part of the pipeline no offline test can establish.
    const chars = d.ocr?.rawText?.length ?? 0;
    if (chars > 0) scanned++;

    const similarity =
      typeof d.validation?.nameSimilarity === 'number'
        ? `${(d.validation.nameSimilarity * 100).toFixed(1)}%`
        : '-';

    console.log(
      `  ${String(d.docType).padEnd(20)} idType=${String(d.idType ?? 'null').padEnd(10)} ` +
        `[${String(d.status).padEnd(8)}] back=${d.backFileUrl ? 'yes' : 'no '}  ` +
        `ocr=${String(chars).padStart(5)} chars  ` +
        `conf=${String(Math.round(d.ocr?.meanConfidence ?? 0)).padStart(3)}%  ` +
        `similarity=${similarity.padStart(7)}  ` +
        `verdict=${d.validation?.verdict ?? 'not scanned'}`,
    );
  }

  if (documents.size > 0) {
    console.log(
      `  -> ${scanned} of ${documents.size} carry real OCR text` +
        (scanned > 0
          ? ' (OCR in a browser is proven, not just unit-tested)'
          : ' (OCR has not run on any upload yet)'),
    );
  }

  const held = await adminDb
    .collection('units')
    .where('status', '==', 'on_hold')
    .get();
  console.log(`\nunits on hold: ${held.size}`);
  for (const doc of held.docs) {
    const u = doc.data();
    console.log(`  ${u.unitNo}  heldBy=${u.heldBy}`);
  }

  console.log('');
  process.exit(0);
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
