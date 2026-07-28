import { type Unit, UnitStatus } from '@sfsr/shared';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatPeso, useBrowsableUnits } from '../units/useUnits';

const ANY = 'any';

/** Public unit catalogue. No account required, per the study's Step 1. */
export default function UnitsPage() {
  const { units, available, loading, error } = useBrowsableUnits();
  const onHoldCount = units.length - available.length;

  // Seeded from the URL so the home page's search box lands here with filters
  // already applied, and so a filtered view can be shared as a link.
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const [type, setType] = useState(params.get('type') ?? ANY);
  const [building, setBuilding] = useState(ANY);
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') ?? '');

  const buildings = useMemo(
    () => [...new Set(units.map((u) => u.building))].sort(),
    [units],
  );
  const types = useMemo(
    () => [...new Set(units.map((u) => u.type))].sort(),
    [units],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const ceiling = Number(maxPrice) || Infinity;

    return units.filter((unit) => {
      if (type !== ANY && unit.type !== type) return false;
      if (building !== ANY && unit.building !== building) return false;
      if (unit.price > ceiling) return false;
      if (!needle) return true;

      return (
        unit.unitNo.toLowerCase().includes(needle) ||
        unit.building.toLowerCase().includes(needle) ||
        unit.type.toLowerCase().includes(needle) ||
        unit.projectName.toLowerCase().includes(needle)
      );
    });
  }, [units, search, type, building, maxPrice]);

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
        <p>
          {available.length} available
          {onHoldCount > 0 && (
            <>
              {' '}
              &middot; {onHoldCount} on hold and being processed
            </>
          )}
        </p>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search unit number, tower, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value={ANY}>All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={building} onChange={(e) => setBuilding(e.target.value)}>
          <option value={ANY}>All towers</option>
          {buildings.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
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
        <div className="unit-grid">
          {filtered.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </>
  );
}

function UnitCard({ unit }: { unit: Unit }) {
  const onHold = unit.status === UnitStatus.ON_HOLD;

  return (
    <Link
      to={`/units/${unit.id}`}
      className={`unit-card${onHold ? ' is-on-hold' : ''}`}
    >
      <div className="unit-card-media">
        {unit.images[0] ? (
          <img src={unit.images[0]} alt={`Unit ${unit.unitNo}`} />
        ) : (
          <span className="unit-card-type">{unit.type}</span>
        )}
        {onHold ? (
          <span className="unit-hold-badge">On hold</span>
        ) : (
          unit.promo && <span className="unit-promo">{unit.promo}</span>
        )}
      </div>
      <div className="unit-card-body">
        <h3>Unit {unit.unitNo}</h3>
        <p className="unit-card-sub">
          {unit.building} &middot; {unit.floorAreaSqm} sqm &middot; Floor{' '}
          {unit.floor}
        </p>
        <p className="unit-card-price">{formatPeso(unit.price)}</p>
        {onHold && (
          <p className="unit-hold-note">
            Reserved by another buyer and awaiting approval.
          </p>
        )}
      </div>
    </Link>
  );
}
