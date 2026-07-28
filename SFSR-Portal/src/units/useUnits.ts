import { COLLECTIONS, type Unit, UnitStatus, db } from '@sfsr/shared';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

/**
 * Live list of units still on the market.
 *
 * Filtering by `available` in the query (not in the UI) is what makes an
 * approved unit disappear from the portal the moment staff approve it, which is
 * the behaviour the study specifies. `onSnapshot` means no refresh is needed.
 */
export function useAvailableUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.UNITS),
      where('status', '==', UnitStatus.AVAILABLE),
      orderBy('price'),
    );

    return onSnapshot(
      q,
      (snap) => {
        setUnits(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Unit));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, []);

  return { units, loading, error };
}

/** Live single unit, including ones no longer available. */
export function useUnit(unitId: string | undefined) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!unitId) {
      setLoading(false);
      return;
    }
    return onSnapshot(doc(db, COLLECTIONS.UNITS, unitId), (snap) => {
      setUnit(snap.exists() ? ({ id: snap.id, ...snap.data() } as Unit) : null);
      setLoading(false);
    });
  }, [unitId]);

  return { unit, loading };
}

export const formatPeso = (value: number): string =>
  `₱${value.toLocaleString('en-PH')}`;
