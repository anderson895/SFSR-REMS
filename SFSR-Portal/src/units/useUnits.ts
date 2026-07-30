import {
  CATALOGUE_PAGE_SIZE,
  COLLECTIONS,
  FLOOR_PAGE_SIZE,
  MAX_PROJECTS,
  MAX_UNIT_TYPES,
  type Project,
  type Unit,
  UnitStatus,
  type UnitType,
  db,
} from '@sfsr/shared';
import {
  collection,
  doc,
  getCountFromServer,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Statuses the public catalogue is allowed to show. */
const BROWSABLE = [UnitStatus.AVAILABLE, UnitStatus.ON_HOLD];

/**
 * Page sizes come from the shared constants so `npm run measure` reports the
 * numbers the app actually uses. Duplicated, they drift: the page size dropped
 * to 24 while the report went on printing 60.
 */
const PAGE_SIZE = CATALOGUE_PAGE_SIZE;

/* ------------------------------------------------------------------ catalogue
 *
 * The catalogue is built from `projects` and `unitTypes`, not by reading units
 * and grouping them. One project plus four types is five documents; summarising
 * 320 units to reach the same screen cost 320 reads and, once the unit listener
 * was capped, quietly produced wrong numbers — the expensive types fell outside
 * the cheapest page and vanished from the listing entirely.
 */

/** Every development, from the `projects` collection. */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, COLLECTIONS.PROJECTS), limitTo(MAX_PROJECTS)),
        (snap) => {
          setProjects(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project),
          );
          setError('');
          setLoading(false);
        },
        (err) => {
          setError(`${err.code}: ${err.message}`);
          setLoading(false);
        },
      ),
    [],
  );

  return { projects, loading, error };
}

/** One type card: what the catalogue shows before a buyer picks a layout. */
export interface TypeSummary extends UnitType {
  /** Units of this type not currently reserved or held. */
  availableCount: number;
}

/**
 * The unit types on offer, with live availability.
 *
 * The type documents supply everything static — floor area, floor plan,
 * images, description, starting price. Only the availability count has to come
 * from the units themselves, and that uses `getCountFromServer`, which bills one
 * read per 1,000 matching documents rather than one per document.
 */
export function useTypeSummaries(projectName?: string) {
  const [types, setTypes] = useState<UnitType[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const base = collection(db, COLLECTIONS.UNIT_TYPES);
    const q = projectName
      ? query(base, where('projectName', '==', projectName), limitTo(MAX_UNIT_TYPES))
      : query(base, limitTo(MAX_UNIT_TYPES));

    return onSnapshot(
      q,
      (snap) => {
        setTypes(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as UnitType)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        );
        setError('');
        setLoading(false);
      },
      (err) => {
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      },
    );
  }, [projectName]);

  const typeIds = useMemo(() => types.map((t) => t.id).join(','), [types]);

  useEffect(() => {
    if (!typeIds) return;
    let cancelled = false;

    Promise.all(
      typeIds.split(',').map(async (typeId) => {
        const snap = await getCountFromServer(
          query(
            collection(db, COLLECTIONS.UNITS),
            where('typeId', '==', typeId),
            where('status', '==', UnitStatus.AVAILABLE),
          ),
        );
        return [typeId, snap.data().count] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) setCounts(Object.fromEntries(entries));
      })
      // A missing count leaves the card showing its total instead; it must not
      // take the catalogue down.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [typeIds]);

  const summaries: TypeSummary[] = useMemo(
    () =>
      types.map((t) => ({
        ...t,
        availableCount: counts[t.id] ?? t.totalCount,
      })),
    [types, counts],
  );

  const totalAvailable = summaries.reduce((n, s) => n + s.availableCount, 0);

  return { summaries, totalAvailable, loading, error };
}

/** A development as the listings present it. */
export interface ProjectSummary {
  id: string;
  name: string;
  location: string;
  image: string;
  /** Cheapest available unit across all of the project's types. */
  startingPrice: number;
  availableCount: number;
  /** Type labels on offer, cheapest first. */
  types: string[];
  amenities: string[];
}

/**
 * Developments with their headline figures.
 *
 * Composed from the two summary collections rather than from units: a project's
 * starting price is the lowest of its types' starting prices, and its
 * availability is the sum of theirs. Roughly five documents for the whole
 * catalogue.
 */
export function useProjectSummaries() {
  const { projects, loading: projectsLoading, error } = useProjects();
  const { summaries, loading: typesLoading } = useTypeSummaries();

  const result = useMemo<ProjectSummary[]>(
    () =>
      projects.map((project) => {
        const own = summaries
          .filter((t) => t.projectId === project.id)
          .sort((a, b) => a.startingPrice - b.startingPrice);

        return {
          id: project.id,
          name: project.name,
          location: project.location,
          image: project.images?.[0] ?? '',
          startingPrice: own[0]?.startingPrice ?? 0,
          availableCount: own.reduce((n, t) => n + t.availableCount, 0),
          types: own.map((t) => t.type),
          amenities: project.amenities ?? [],
        };
      }),
    [projects, summaries],
  );

  return {
    projects: result,
    loading: projectsLoading || typesLoading,
    error,
  };
}

/* ---------------------------------------------------------------------- units */

/**
 * Every unit of one type, loaded when a type card is opened.
 *
 * Scoped by type rather than taken from a capped catalogue-wide listener, so
 * the floor-by-floor view is complete even for the most expensive layouts.
 */
export function useUnitsOfType(typeId?: string, pageSize = FLOOR_PAGE_SIZE) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [pageLimit, setPageLimit] = useState(pageSize);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // A different type starts a fresh page, otherwise opening a small type after
  // a large one would carry the larger one's expanded window across.
  useEffect(() => setPageLimit(pageSize), [typeId, pageSize]);

  useEffect(() => {
    if (!typeId) {
      setUnits([]);
      return;
    }

    setLoading(true);
    // Ordered by floor so a page break falls between floors rather than
    // splitting one across two pages.
    const q = query(
      collection(db, COLLECTIONS.UNITS),
      where('typeId', '==', typeId),
      where('status', 'in', BROWSABLE),
      orderBy('floor'),
      limitTo(pageLimit),
    );

    return onSnapshot(
      q,
      (snap) => {
        setUnits(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Unit));
        setError('');
        setLoading(false);
      },
      (err) => {
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      },
    );
  }, [typeId, pageLimit]);

  const loadMore = useCallback(
    () => setPageLimit((current) => current + pageSize),
    [pageSize],
  );

  return { units, loadMore, loading, error };
}

/**
 * A capped, price-ordered window over the whole inventory.
 *
 * Only the search view uses this — the type cards are served from `unitTypes`.
 * Text search cannot be pushed to Firestore, so it runs over whatever is
 * loaded, and the caller offers a control to reach further.
 */
export function useBrowsableUnits(enabled = true, pageSize = PAGE_SIZE) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [pageLimit, setPageLimit] = useState(pageSize);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    getCountFromServer(
      query(collection(db, COLLECTIONS.UNITS), where('status', 'in', BROWSABLE)),
    )
      .then((snap) => setTotal(snap.data().count))
      .catch(() => setTotal(null));
  }, [enabled]);

  useEffect(() => {
    // Nothing is fetched until someone actually searches. Most visitors browse
    // by type card and never type a word, and subscribing anyway cost them 48
    // document reads each for a list they never saw.
    if (!enabled) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.UNITS),
      where('status', 'in', BROWSABLE),
      orderBy('price'),
      limitTo(pageLimit),
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
  }, [enabled, pageLimit]);

  const loadMore = useCallback(
    () => setPageLimit((current) => current + pageSize),
    [pageSize],
  );

  const available = units.filter((u) => u.status === UnitStatus.AVAILABLE);
  const hasMore = total !== null && units.length < total;

  return { units, available, total, hasMore, loadMore, loading, error };
}

/**
 * A single unit together with the project and type it belongs to.
 *
 * The detail page needs amenities, floor plan, and description, which now live
 * on those two documents. Three live reads for one page is the cost of not
 * copying that content onto all 320 units.
 */
export function useUnit(unitId: string | undefined) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [unitType, setUnitType] = useState<UnitType | null>(null);
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

  useEffect(() => {
    if (!unit?.projectId) return;
    return onSnapshot(doc(db, COLLECTIONS.PROJECTS, unit.projectId), (snap) =>
      setProject(
        snap.exists() ? ({ id: snap.id, ...snap.data() } as Project) : null,
      ),
    );
  }, [unit?.projectId]);

  useEffect(() => {
    if (!unit?.typeId) return;
    return onSnapshot(doc(db, COLLECTIONS.UNIT_TYPES, unit.typeId), (snap) =>
      setUnitType(
        snap.exists() ? ({ id: snap.id, ...snap.data() } as UnitType) : null,
      ),
    );
  }, [unit?.typeId]);

  return { unit, project, unitType, loading };
}

/* --------------------------------------------------------------- formatting */

/**
 * Tolerates a missing number on purpose.
 *
 * These figures come from Firestore documents, and a field added in a later
 * release is simply absent on records written before it. `undefined.toLocaleString()`
 * throws, which would take down a whole page over one missing price — so a
 * dash is shown instead.
 */
export const formatPeso = (value: number | undefined | null): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `₱${value.toLocaleString('en-PH')}`
    : '—';

/**
 * Compact price for cards, e.g. ₱5.04M.
 *
 * Listings quote a starting price to signal a bracket, not an exact figure —
 * the full peso amount belongs on the unit's own page where it is the real
 * number being offered.
 */
export const formatPesoShort = (value: number | undefined | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `₱${Math.round(value / 1_000)}K`;
  return formatPeso(value);
};
