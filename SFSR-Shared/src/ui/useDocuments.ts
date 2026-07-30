import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { DocumentStatus, REQUIRED_DOC_TYPES } from '../constants';
import { COLLECTIONS, db } from '../firebase';
import type { DocumentRecord } from '../types';

/**
 * Live list of documents attached to one reservation.
 *
 * `buyerUid` must be supplied when the caller is the buyer themselves, and
 * omitted when it is staff.
 *
 * Firestore rules are not filters. For a query, the server has to be able to
 * *prove* every result is readable before it will run it — so the rule
 * `resource.data.buyerUid == request.auth.uid` is only satisfiable if the
 * query itself constrains `buyerUid`. Without it a buyer's listener fails with
 * permission-denied while the same query succeeds for staff, whose `isStaff()`
 * branch short-circuits the rule.
 *
 * That failure is easy to miss: documents this client just wrote are served
 * from the local cache, so the list looks correct until the page is reloaded
 * with a cold cache and silently empties.
 */
export function useReservationDocuments(
  reservationId: string | undefined,
  buyerUid?: string | null,
) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reservationId) {
      setLoading(false);
      return;
    }

    const constraints = [where('reservationId', '==', reservationId)];
    if (buyerUid) constraints.push(where('buyerUid', '==', buyerUid));

    // Bounded even though a reservation carries only a handful of documents:
    // a re-upload loop or a scripted test can grow this without anyone noticing,
    // and the listener would bill the whole set on every attach.
    const q = query(
      collection(db, COLLECTIONS.DOCUMENTS),
      ...constraints,
      orderBy('uploadedAt'),
      limit(100),
    );

    // Always pass an error callback. A listener that fails without one renders
    // as an empty list, indistinguishable from "nothing uploaded yet".
    return onSnapshot(
      q,
      (snap) => {
        setDocuments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DocumentRecord),
        );
        // Cleared on success so a recovered listener stops reporting a stale
        // failure.
        setError('');
        setLoading(false);
      },
      (err) => {
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      },
    );
  }, [reservationId, buyerUid]);

  return { documents, loading, error };
}

/**
 * Progress against the required-document checklist.
 *
 * A requirement counts as met only when an APPROVED document of that type
 * exists. A merely uploaded file is not compliance — staff still have to accept
 * it, which is the human judgement the study insists on keeping in the loop.
 */
export function requirementProgress(documents: DocumentRecord[]) {
  const approved = new Set(
    documents
      .filter((d) => d.status === DocumentStatus.APPROVED)
      .map((d) => d.docType),
  );

  const missing = REQUIRED_DOC_TYPES.filter((type) => !approved.has(type));

  return {
    approved,
    missing,
    complete: missing.length === 0,
    total: REQUIRED_DOC_TYPES.length,
    met: REQUIRED_DOC_TYPES.length - missing.length,
  };
}
