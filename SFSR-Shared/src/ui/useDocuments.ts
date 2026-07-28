import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { DocumentStatus, REQUIRED_DOC_TYPES } from '../constants';
import { COLLECTIONS, db } from '../firebase';
import type { DocumentRecord } from '../types';

/** Live list of documents attached to one reservation. */
export function useReservationDocuments(reservationId: string | undefined) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reservationId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.DOCUMENTS),
      where('reservationId', '==', reservationId),
      orderBy('uploadedAt'),
    );

    // Always pass an error callback. A listener that fails without one renders
    // as an empty list, indistinguishable from "nothing uploaded yet".
    return onSnapshot(
      q,
      (snap) => {
        setDocuments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DocumentRecord),
        );
        setLoading(false);
      },
      (err) => {
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      },
    );
  }, [reservationId]);

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
