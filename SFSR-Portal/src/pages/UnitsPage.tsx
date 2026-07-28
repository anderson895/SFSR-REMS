import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { type Unit, UnitStatus } from '@sfsr/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatPeso, formatPesoShort, useBrowsableUnits } from '../units/useUnits';

const ANY = 'any';

/**
 * Public unit catalogue. No account required, per the study's Step 1.
 *
 * Browsing is layered rather than flat: unit type, then floor, then unit. A
 * single list of 320 rows put four Studios on the same floor next to each
 * other, identical in every column but the unit number — nobody chooses
 * between those, so the list was long without being informative. Layering it
 * mirrors how the inventory is actually shaped.
 *
 * Searching and price filtering cut across types, so those fall back to a flat
 * result list; there is no sensible type card for "everything under ₱7M".
 */
export default function UnitsPage() {
  const { units, available, loading, error } = useBrowsableUnits();

  // Seeded from the URL so the home page's search box lands here with filters
  // already applied, and so a filtered view can be shared as a link.
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const [project, setProject] = useState(params.get('project') ?? ANY);
  const [minPrice, setMinPrice] = useState(params.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') ?? '');

  /** Which type card has been opened, if any. */
  const [selected, setSelected] = useState<{
    project: string;
    type: string;
  } | null>(null);

  const projects = useMemo(
    () => [...new Set(units.map((u) => u.projectName))].sort(),
    [units],
  );

  const searching =
    search.trim() !== '' || minPrice !== '' || maxPrice !== '';

  // A type opened under one set of filters is meaningless under another.
  useEffect(() => {
    setSelected(null);
  }, [search, project, minPrice, maxPrice]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const floor = Number(minPrice) || 0;
    const ceiling = Number(maxPrice) || Infinity;

    return units.filter((unit) => {
      if (project !== ANY && unit.projectName !== project) return false;
      if (unit.price < floor || unit.price > ceiling) return false;
      if (!needle) return true;

      return (
        unit.unitNo.toLowerCase().includes(needle) ||
        unit.building.toLowerCase().includes(needle) ||
        unit.type.toLowerCase().includes(needle) ||
        unit.projectName.toLowerCase().includes(needle) ||
        (unit.location ?? '').toLowerCase().includes(needle)
      );
    });
  }, [units, search, project, minPrice, maxPrice]);

  /** One card per development-and-type pair. */
  const typeGroups = useMemo(() => {
    const groups = new Map<string, TypeGroup>();

    for (const unit of filtered) {
      const key = `${unit.projectName}|${unit.type}`;
      let group = groups.get(key);

      if (!group) {
        group = {
          key,
          project: unit.projectName,
          location: unit.location ?? '',
          type: unit.type,
          floorAreaSqm: unit.floorAreaSqm,
          floorPlanUrl: unit.floorPlanUrl ?? '',
          description: unit.description ?? '',
          availableCount: 0,
          minPrice: Infinity,
          maxPrice: 0,
          units: [],
        };
        groups.set(key, group);
      }

      group.units.push(unit);
      if (unit.status === UnitStatus.AVAILABLE) {
        group.availableCount++;
        group.minPrice = Math.min(group.minPrice, unit.price);
        group.maxPrice = Math.max(group.maxPrice, unit.price);
      }
    }

    return [...groups.values()]
      .map((g) => ({
        ...g,
        minPrice: Number.isFinite(g.minPrice) ? g.minPrice : 0,
      }))
      .sort((a, b) => a.minPrice - b.minPrice);
  }, [filtered]);

  const openGroup = selected
    ? typeGroups.find(
        (g) => g.project === selected.project && g.type === selected.type,
      )
    : undefined;

  if (loading) {
    return (
      <p className="py-8 text-center text-gray-500">Loading available units…</p>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="mt-0 text-lg font-semibold text-red-800">
          Could not load units
        </h2>
        <p className="mb-0 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  const filterField =
    'min-w-40 flex-1 rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink focus:outline-2 focus:-outline-offset-1 focus:outline-brand';

  return (
    <>
      <div className="mb-6">
        <h1 className="mb-1 text-3xl font-bold">Available units</h1>
        <p className="text-gray-500">
          {available.length} available across {projects.length} project
          {projects.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search unit number, project, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${filterField} min-w-64 basis-80`}
        />
        {projects.length > 1 && (
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className={filterField}
          >
            <option value={ANY}>All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          placeholder="Min price"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className={filterField}
        />
        <input
          type="number"
          placeholder="Max price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className={filterField}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="mt-0 text-lg font-semibold">No matching units</h2>
          <p className="mb-0 text-gray-500">Try widening your filters.</p>
        </div>
      ) : searching ? (
        <SearchResults units={filtered} />
      ) : openGroup ? (
        <FloorBrowser group={openGroup} onBack={() => setSelected(null)} />
      ) : (
        <TypeCards
          groups={typeGroups}
          showProject={projects.length > 1}
          onOpen={(g) => setSelected({ project: g.project, type: g.type })}
        />
      )}
    </>
  );
}

interface TypeGroup {
  key: string;
  project: string;
  location: string;
  type: string;
  floorAreaSqm: number;
  floorPlanUrl: string;
  description: string;
  availableCount: number;
  minPrice: number;
  maxPrice: number;
  units: Unit[];
}

/**
 * The entry point: one card per unit type.
 *
 * The floor plan is the image here, not the building render. It is the only
 * picture in the inventory that actually differs between these cards, so it is
 * the only one that helps a buyer tell them apart.
 */
function TypeCards({
  groups,
  showProject,
  onOpen,
}: {
  groups: TypeGroup[];
  showProject: boolean;
  onOpen: (group: TypeGroup) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map((group) => (
        <button
          key={group.key}
          type="button"
          className="card group flex cursor-pointer flex-col overflow-hidden p-0 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-xl"
          onClick={() => onOpen(group)}
        >
          {/* `contain`, never `cover`: the plan is a wide sheet with a title
              block, and cover would crop the drawing and leave only the block. */}
          <span className="block h-36 border-b border-line bg-brand-tint">
            {group.floorPlanUrl && (
              <img
                src={group.floorPlanUrl}
                alt={`${group.type} floor plan`}
                className="size-full object-contain"
              />
            )}
          </span>

          <span className="flex flex-col px-4 pb-5 pt-4">
            <span className="text-2xl font-bold leading-none text-brand">
              {group.type}
            </span>
            {showProject && (
              <span className="mt-0.5 text-xs text-gray-500">
                {group.project}
              </span>
            )}
            <span className="mt-1 text-[0.9rem]">{group.floorAreaSqm} sqm</span>

            <span className="mt-2 text-[0.82rem] font-semibold text-green-700">
              {group.availableCount} unit
              {group.availableCount === 1 ? '' : 's'} available
            </span>

            <span className="mt-3 text-[0.7rem] uppercase tracking-wider text-gray-500">
              from
            </span>
            <span className="text-2xl font-bold leading-none">
              {formatPesoShort(group.minPrice)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Units of one type, one row per floor.
 *
 * Every unit on a floor shares a price and a layout, so the price belongs to
 * the row and the unit numbers become the only thing worth clicking.
 */
function FloorBrowser({
  group,
  onBack,
}: {
  group: TypeGroup;
  onBack: () => void;
}) {
  const floors = useMemo(() => {
    const byFloor = new Map<number, Unit[]>();
    for (const unit of group.units) {
      const list = byFloor.get(unit.floor);
      if (list) list.push(unit);
      else byFloor.set(unit.floor, [unit]);
    }

    return [...byFloor.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([floor, units]) => ({
        floor,
        units: [...units].sort((a, b) => a.unitNo.localeCompare(b.unitNo)),
      }));
  }, [group.units]);

  return (
    <section>
      <button type="button" className="btn btn-ghost mb-5" onClick={onBack}>
        <ArrowLeftIcon className="icon" />
        All unit types
      </button>

      <header className="flex flex-col items-start gap-5 rounded-t-xl border border-b-0 border-line bg-white p-5 sm:flex-row">
        {group.floorPlanUrl && (
          <img
            src={group.floorPlanUrl}
            alt={`${group.type} floor plan`}
            className="h-32 w-full shrink-0 rounded-lg bg-brand-tint object-contain sm:w-44"
          />
        )}
        <div>
          <h2 className="m-0 text-xl font-semibold text-brand">
            {group.type} &middot; {group.floorAreaSqm} sqm
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {group.project}
            {group.location && <> &middot; {group.location}</>}
          </p>
          {group.description && (
            <p className="mt-2 max-w-[60ch] text-[0.88rem] leading-relaxed">
              {group.description}
            </p>
          )}
          <p className="mt-2 text-sm font-semibold">
            {group.availableCount} available &middot;{' '}
            {formatPeso(group.minPrice)} – {formatPeso(group.maxPrice)}
          </p>
        </div>
      </header>

      <ul className="mb-10 overflow-hidden rounded-b-xl border border-line bg-white">
        {floors.map(({ floor, units }) => (
          <li
            key={floor}
            className="flex flex-wrap items-center gap-4 px-5 py-2.5 not-first:border-t not-first:border-line"
          >
            <span className="w-20 shrink-0 text-sm text-gray-500">
              Floor {floor}
            </span>
            <span className="flex flex-1 flex-wrap gap-1.5">
              {units.map((unit) => {
                const onHold = unit.status === UnitStatus.ON_HOLD;
                return (
                  <Link
                    key={unit.id}
                    to={`/units/${unit.id}`}
                    className={`inline-flex min-w-13 items-center justify-center rounded-md border px-2.5 py-1.5 text-sm font-semibold no-underline ${
                      onHold
                        ? 'border-amber-200 bg-amber-100 text-amber-800 line-through hover:bg-amber-200'
                        : 'border-line bg-brand-tint text-brand hover:border-brand hover:bg-brand hover:text-white'
                    }`}
                    title={
                      onHold
                        ? `Unit ${unit.unitNo} — on hold`
                        : `Unit ${unit.unitNo} — ${formatPeso(unit.price)}`
                    }
                  >
                    {unit.unitNo}
                  </Link>
                );
              })}
            </span>
            {/* Units on a floor share a price, so one figure covers the row. */}
            <span className="shrink-0 font-semibold tabular-nums">
              {formatPeso(units[0].price)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Flat results, used when a search or price range cuts across types. */
function SearchResults({ units }: { units: Unit[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [units]);

  return (
    <>
      <p className="mb-3 text-sm text-gray-500">
        {units.length} matching unit{units.length === 1 ? '' : 's'}
      </p>

      <ul className="overflow-hidden rounded-xl border border-line bg-white">
        {units.slice(0, visible).map((unit) => {
          const onHold = unit.status === UnitStatus.ON_HOLD;
          return (
            <li key={unit.id} className="not-first:border-t not-first:border-line">
              <Link
                to={`/units/${unit.id}`}
                className={`flex flex-wrap items-baseline gap-4 px-4 py-3 no-underline hover:bg-canvas ${
                  onHold ? 'text-gray-500' : 'text-ink'
                }`}
              >
                <span className="w-26 shrink-0 font-semibold">
                  Unit {unit.unitNo}
                </span>
                <span className="w-16 shrink-0 text-[0.85rem] font-semibold text-brand">
                  {unit.type}
                </span>
                <span className="text-sm text-gray-500">
                  {unit.floorAreaSqm} sqm &middot; Floor {unit.floor}
                </span>
                <span className="ml-auto flex items-baseline gap-3 whitespace-nowrap">
                  {onHold && (
                    <span className="pill border-amber-200 bg-amber-100 text-amber-800">
                      On hold
                    </span>
                  )}
                  <span className="font-semibold tabular-nums">
                    {formatPeso(unit.price)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {units.length > visible && (
        <div className="my-6 text-center">
          <p className="mb-2.5 text-sm text-gray-500">
            Showing {visible} of {units.length}
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setVisible((n) => n + PAGE_SIZE)}
          >
            Show more units
          </button>
        </div>
      )}
    </>
  );
}

const PAGE_SIZE = 50;
