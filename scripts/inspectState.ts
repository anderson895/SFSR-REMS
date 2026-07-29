/**
 * Prints the current reservation / document / hold state.
 *
 *   npx tsx scripts/inspectState.ts
 *
 * Read-only. Useful after a manual run through the portal to confirm what the
 * flow actually wrote, rather than what it appeared to do on screen.
 */

import { adminDb } from './adminApp';

async function main() {
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
  for (const doc of documents.docs) {
    const d = doc.data();
    console.log(
      `  ${d.docType}  idType=${d.idType ?? 'null'}  [${d.status}]  ` +
        `back=${d.backFileUrl ? 'yes' : 'no'}  ` +
        `verdict=${d.validation?.verdict ?? 'not scanned'}  ` +
        `idTypeMatch=${d.validation?.idTypeMatch ?? 'n/a'}`,
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
