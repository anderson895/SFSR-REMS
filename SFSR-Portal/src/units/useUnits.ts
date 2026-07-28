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

/** Statuses the public catalogue is allowed to show. */
const BROWSABLE = [UnitStatus.AVAILABLE, UnitStatus.ON_HOLD];

/**
 * Live list of units the public catalogue shows.
 *
 * Includes `on_hold` deliberately. The study requires an approved unit to
 * disappear — and `reserved`/`sold` still do, because they are absent from this
 * query — but a unit that is merely being processed is shown, locked, rather
 * than vanishing without explanation.
 *
 * Showing the hold is what makes the double-selling guard visible: two buyers
 * on the same unit see it flip to "On Hold" in real time instead of one of them
 * watching it silently disappear. Filtering happens in the query, not the UI,
 * so a sold unit is never sent to the browser in the first place.
 */
export function useBrowsableUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.UNITS),
      where('status', 'in', BROWSABLE),
      orderBy('price'),
    );

    return onSnapshot(
      q,
      (snap) => {
        setUnits(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Unit));
        setLoading(false);
      },
      (err) => {
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      },
    );
  }, []);

  const available = units.filter((u) => u.status === UnitStatus.AVAILABLE);

  return { units, available, loading, error };
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
