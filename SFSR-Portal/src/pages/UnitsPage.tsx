import { type Unit, UnitStatus } from '@sfsr/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatPeso, useBrowsableUnits } from '../units/useUnits';

const ANY = 'any';
const PAGE_SIZE = 50;

/** Public unit catalogue. No account required, per the study's Step 1. */
export default function UnitsPage() {
  const { units, available, loading, error } = useBrowsableUnits();
  const onHoldCount = units.length - available.length;

  // Seeded from the URL so the home page's search box lands here with filters
  // already applied, and so a filtered view can be shared as a link.
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const [project, setProject] = useState(params.get('project') ?? ANY);
  const [type, setType] = useState(params.get('type') ?? ANY);
  const [building, setBuilding] = useState(ANY);
  const [minPrice, setMinPrice] = useState(params.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') ?? '');

  /**
   * How many rows to render before the "Show more" button.
   *
   * The inventory arrives as one live `onSnapshot`, so this caps the DOM, not
   * the query. 320 rows at once is a wall of text however it is styled, and a
   * buyer narrowing by type rarely needs to see past the first page.
   */
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Any change to the filters means the old offset describes a different list.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [search, project, type, building, minPrice, maxPrice]);

  const projects = useMemo(
    () => [...new Set(units.map((u) => u.projectName))].sort(),
    [units],
  );
  // Scoped to the chosen project: picking a tower from a different development
  // would silently produce an empty list.
  const buildings = useMemo(
    () =>
      [
        ...new Set(
          units
            .filter((u) => project === ANY || u.projectName === project)
            .map((u) => u.building),
        ),
      ].sort(),
    [units, project],
  );
  const types = useMemo(
    () => [...new Set(units.map((u) => u.type))].sort(),
    [units],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const floor = Number(minPrice) || 0;
    const ceiling = Number(maxPrice) || Infinity;

    return units.filter((unit) => {
      if (project !== ANY && unit.projectName !== project) return false;
      if (type !== ANY && unit.type !== type) return false;
      if (building !== ANY && unit.building !== building) return false;
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
  }, [units, search, project, type, building, minPrice, maxPrice]);

  /** Matching units bucketed under their development, price order preserved. */
  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; location: string; image: string; units: Unit[] }
    >();

    // Sliced before grouping so the cap applies to the result as a whole
    // rather than to each development separately.
    for (const unit of filtered.slice(0, visible)) {
      let group = groups.get(unit.projectName);
      if (!group) {
        group = {
          name: unit.projectName,
          location: unit.location ?? '',
          image: unit.images[0] ?? '',
          units: [],
        };
        groups.set(unit.projectName, group);
      }
      group.units.push(unit);
    }

    return [...groups.values()];
  }, [filtered, visible]);

  const filtersActive =
    search.trim() !== '' ||
    project !== ANY ||
    type !== ANY ||
    building !== ANY ||
    minPrice !== '' ||
    maxPrice !== '';

  if (loading) return <p className="loading">Loading available units…</p>;

  if (error) {
    return (
      <div className="notice notice-error">
        <h2>Could not load units</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Available units</h1>
        {/* Once a filter is on, the total is the wrong number to lead with —
            it reads as though the filter did nothing. */}
        <p>
          {filtersActive ? (
            <>
              {filtered.length} matching &middot; {available.length} available in
              total
            </>
          ) : (
            <>
              {available.length} available
              {onHoldCount > 0 && (
                <> &middot; {onHoldCount} on hold and being processed</>
              )}
            </>
          )}
        </p>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search unit number, project, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {projects.length > 1 && (
          <select
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              // The previously chosen tower probably belongs to the old project.
              setBuilding(ANY);
            }}
          >
            <option value={ANY}>All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value={ANY}>All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {/* A single-tower development has nothing to choose between. */}
        {buildings.length > 1 && (
          <select value={building} onChange={(e) => setBuilding(e.target.value)}>
            <option value={ANY}>All towers</option>
            {buildings.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          placeholder="Min price"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <input
          type="number"
          placeholder="Max price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="notice">
          <h2>No matching units</h2>
          <p>Try widening your filters.</p>
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.name} className="project-group">
            {/* The render belongs to the development, not to any one unit, so
                it is shown once here instead of being repeated down the list. */}
            <header className="project-banner">
              {group.image && <img src={group.image} alt={group.name} />}
              <div className="project-banner-text">
                <h2>{group.name}</h2>
                {group.location && <p>{group.location}</p>}
              </div>
              <span className="project-banner-count">
                {group.units.length} unit{group.units.length === 1 ? '' : 's'}
              </span>
            </header>

            <ul className="unit-list">
              {group.units.map((unit) => (
                <UnitRow key={unit.id} unit={unit} />
              ))}
            </ul>
          </section>
        ))
      )}

      {filtered.length > visible && (
        <div className="list-more">
          <p>
            Showing {visible} of {filtered.length}
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

/**
 * One scannable line per unit.
 *
 * Deliberately has no image. Every unit in a development shares the same
 * building render, so a thumbnail per row carries no information that would
 * help a buyer choose between them — it only makes the list longer. The
 * pictures live on the unit's own page, where they describe that unit.
 */
function UnitRow({ unit }: { unit: Unit }) {
  const onHold = unit.status === UnitStatus.ON_HOLD;

  return (
    <li>
      <Link
        to={`/units/${unit.id}`}
        className={`unit-row${onHold ? ' is-on-hold' : ''}`}
      >
        <span className="unit-row-no">Unit {unit.unitNo}</span>
        <span className="unit-row-type">{unit.type}</span>
        <span className="unit-row-spec">
          {unit.floorAreaSqm} sqm &middot; Floor {unit.floor}
        </span>
        <span className="unit-row-tail">
          {onHold ? (
            <span className="unit-row-flag is-hold">On hold</span>
          ) : (
            unit.promo && <span className="unit-row-flag is-promo">Promo</span>
          )}
          <span className="unit-row-price">{formatPeso(unit.price)}</span>
        </span>
      </Link>
    </li>
  );
}
