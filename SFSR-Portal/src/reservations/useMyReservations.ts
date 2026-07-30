import {
  COLLECTIONS,
  DocumentStatus,
  type DocumentRecord,
  type Reservation,
  ReservationStatus,
  db,
} from '@sfsr/shared';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

/** The signed-in buyer's reservations, newest first. */
export function useMyReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setReservations([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.RESERVATIONS),
      where('buyerUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    return onSnapshot(
      q,
      (snap) => {
        setReservations(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reservation),
        );
        setError('');
        setLoading(false);
      },
      // Reported, not swallowed: an empty list here reads as "you have no
      // reservations", which is alarming and wrong if the listener simply failed.
      (err) => {
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      },
    );
  }, [user]);

  return { reservations, loading, error };
}

/**
 * Does this reservation need something from the buyer?
 *
 * Under Review is precisely the state staff move a reservation into when they
 * have asked for more paperwork, and it is where the remarks are written — so
 * it is the signal, not a proxy for one.
 *
 * Deliberately not "unread". A badge that clears the moment you glance at it
 * tells you what you have seen; this one tells you what is still outstanding,
 * and it clears itself when the work is actually done.
 */
export const reservationNeedsAction = (reservation: Reservation): boolean =>
  reservation.status === ReservationStatus.UNDER_REVIEW;

/**
 * Everything waiting on the buyer, across all their reservations.
 *
 * A rejected document counts too: it carries a staff note and the buyer has to
 * upload a replacement, which is the same kind of outstanding work as an
 * Under Review reservation.
 */
export function useActionItems() {
  const { user } = useAuth();
  const { reservations } = useMyReservations();
  const [rejectedDocs, setRejectedDocs] = useState<DocumentRecord[]>([]);

  useEffect(() => {
    if (!user) {
      setRejectedDocs([]);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.DOCUMENTS),
      where('buyerUid', '==', user.uid),
      where('status', '==', DocumentStatus.REJECTED),
    );

    // Errors are swallowed on purpose: a badge that cannot load is a missing
    // badge, not a reason to break the page it sits on.
    return onSnapshot(
      q,
      (snap) => {
        setRejectedDocs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DocumentRecord),
        );
      },
      () => setRejectedDocs([]),
    );
  }, [user]);

  return useMemo(() => {
    const flagged = new Set(
      reservations.filter(reservationNeedsAction).map((r) => r.id),
    );
    for (const document of rejectedDocs) flagged.add(document.reservationId);

    return {
      /** Reservation ids with outstanding work. */
      flagged,
      count: flagged.size,
      rejectedFor: (reservationId: string) =>
        rejectedDocs.filter((d) => d.reservationId === reservationId).length,
    };
  }, [reservations, rejectedDocs]);
}
