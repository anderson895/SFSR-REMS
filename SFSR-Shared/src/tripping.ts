/**
 * Site-visit ("tripping") requests.
 *
 * The one thing in this system a signed-out visitor can write. That is
 * deliberate — a tripping request is a lead, and requiring an account before
 * someone will even agree to look at the building defeats the purpose. The
 * cost is that `firestore.rules` has to do all the work here, since there is
 * no authenticated identity to lean on; see the field validation there.
 *
 * No unit is held and no reservation is created. This is an enquiry.
 */

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { TrippingStatus } from './constants';
import { COLLECTIONS, db } from './firebase';
import type { TrippingRequest } from './types';

export interface CreateTrippingInput {
  projectName: string;
  fullName: string;
  email: string;
  mobile: string;
  preferredDate: string;
  preferredSlot: string;
  partySize: number;
  message?: string;
  /** Present only when the visitor happened to already be signed in. */
  requestedByUid?: string | null;
}

/** Longest any free-text field may be, matching the rules. */
const MAX_TEXT = 500;

export async function createTrippingRequest(
  input: CreateTrippingInput,
): Promise<string> {
  const message = (input.message ?? '').trim().slice(0, MAX_TEXT);

  const ref = await addDoc(collection(db, COLLECTIONS.TRIPPING), {
    projectName: input.projectName,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    mobile: input.mobile.trim(),
    preferredDate: input.preferredDate,
    preferredSlot: input.preferredSlot,
    partySize: input.partySize,
    message,
    status: TrippingStatus.PENDING,
    requestedByUid: input.requestedByUid ?? null,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

/** Staff decision on a request. */
export async function setTrippingStatus(
  trippingId: string,
  status: Exclude<TrippingStatus, 'pending'>,
  staffUid: string,
  note = '',
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.TRIPPING, trippingId), {
    status,
    handledBy: staffUid,
    handledAt: serverTimestamp(),
    staffNote: note,
  });
}

/**
 * Live tripping requests for the internal app.
 *
 * Ordered by the requested date rather than when the form was submitted —
 * staff work a calendar, and a request filed today for next month must not
 * bury one filed last week for tomorrow.
 */
export function useTrippingRequests(status?: TrippingStatus) {
  const [requests, setRequests] = useState<TrippingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const base = collection(db, COLLECTIONS.TRIPPING);
    const q = status
      ? query(base, where('status', '==', status), orderBy('preferredDate'))
      : query(base, orderBy('preferredDate'));

    return onSnapshot(
      q,
      (snap) => {
        setRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrippingRequest),
        );
        setLoading(false);
      },
      (err) => {
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      },
    );
  }, [status]);

  return { requests, loading, error };
}
