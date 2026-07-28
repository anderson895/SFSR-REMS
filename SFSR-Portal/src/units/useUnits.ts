import { COLLECTIONS, type Unit, UnitStatus, db } from '@sfsr/shared';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

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

/**
 * Compact price for cards, e.g. ₱5.04M.
 *
 * Listings quote a starting price to signal a bracket, not an exact figure —
 * the full peso amount belongs on the unit's own page where it is the real
 * number being offered.
 */
export const formatPesoShort = (value: number): string => {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `₱${Math.round(value / 1_000)}K`;
  return formatPeso(value);
};

/** A development, summarised from the units that belong to it. */
export interface ProjectSummary {
  name: string;
  location: string;
  image: string;
  /** Cheapest available unit — what "price starts at" means on a listing. */
  startingPrice: number;
  availableCount: number;
  /** Unit types on offer, cheapest first. */
  types: string[];
  amenities: string[];
}

/**
 * Groups the live inventory into developments.
 *
 * Derived rather than stored: there is no `projects` collection, and inventing
 * one would give the portal a second source of truth that could disagree with
 * the units it is describing. A project exists exactly as long as it has units.
 */
export function useProjects(): {
  projects: ProjectSummary[];
  loading: boolean;
  error: string;
} {
  const { units, loading, error } = useBrowsableUnits();

  const projects = useMemo(() => {
    const groups = new Map<string, ProjectSummary & { typeOrder: Set<string> }>();

    for (const unit of units) {
      let group = groups.get(unit.projectName);
      if (!group) {
        group = {
          name: unit.projectName,
          location: unit.location ?? '',
          image: unit.images[0] ?? '',
          startingPrice: Infinity,
          availableCount: 0,
          types: [],
          amenities: unit.amenities ?? [],
          typeOrder: new Set<string>(),
        };
        groups.set(unit.projectName, group);
      }

      group.typeOrder.add(unit.type);

      // Only genuinely available units set the advertised starting price; a
      // unit someone else is already processing is not on offer.
      if (unit.status === UnitStatus.AVAILABLE) {
        group.availableCount++;
        group.startingPrice = Math.min(group.startingPrice, unit.price);
      }
    }

    return [...groups.values()].map(({ typeOrder, ...project }) => ({
      ...project,
      types: [...typeOrder],
      startingPrice: Number.isFinite(project.startingPrice)
        ? project.startingPrice
        : 0,
    }));
  }, [units]);

  return { projects, loading, error };
}
