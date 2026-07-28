import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPeso, useBrowsableUnits } from '../units/useUnits';

const ANY = 'any';

/**
 * Public landing page.
 *
 * Every number shown here — unit counts, starting prices, unit types — is read
 * live from Firestore rather than hard-coded. A brochure page that claims "34
 * available units" while the inventory says otherwise is worse than no page at
 * all, and this one cannot drift out of date.
 */
export default function HomePage() {
  // The home page counts and features only genuinely available units — a unit
  // someone else is already processing should not be advertised as an option.
  const { available: units, loading } = useBrowsableUnits();
  const navigate = useNavigate();

  const [type, setType] = useState(ANY);
  const [maxPrice, setMaxPrice] = useState('');

  /** Live per-type summary: how many are left and what they start at. */
  const byType = useMemo(() => {
    const groups = new Map<string, { count: number; from: number }>();
    for (const unit of units) {
      const existing = groups.get(unit.type);
      groups.set(unit.type, {
        count: (existing?.count ?? 0) + 1,
        from: Math.min(existing?.from ?? Infinity, unit.price),
      });
    }
    return [...groups.entries()].sort((a, b) => a[1].from - b[1].from);
  }, [units]);

  const featured = useMemo(() => units.slice(0, 3), [units]);

  const startingPrice = units.length
    ? Math.min(...units.map((u) => u.price))
    : 0;

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (type !== ANY) params.set('type', type);
    if (maxPrice) params.set('maxPrice', maxPrice);
    navigate(`/units?${params.toString()}`);
  }

  return (
    <div className="home">
      {/* ---------------------------------------------------------- hero */}
      <section className="home-hero">
        <div className="home-hero-inner">
          <p className="eyebrow">St. Francis Square Residences · Mandaluyong City</p>
          <h1>Your home in the heart of the metro</h1>
          <p className="home-hero-sub">
            Studio, one-bedroom, and two-bedroom condominium units — browse the
            live inventory, reserve online, and track your requirements from one
            account.
          </p>

          <form className="hero-search" onSubmit={handleSearch}>
            <label>
              Unit type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value={ANY}>Any type</option>
                {byType.map(([t]) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Budget up to
              <input
                type="number"
                placeholder="e.g. 6000000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </label>

            <button type="submit" className="btn btn-gold">
              Search units
            </button>
          </form>

          {!loading && (
            <p className="hero-stat">
              <strong>{units.length}</strong> units available today
              {startingPrice > 0 && (
                <> · starting at <strong>{formatPeso(startingPrice)}</strong></>
              )}
            </p>
          )}
        </div>
      </section>

      {/* --------------------------------------------------- unit types */}
      <section className="home-section">
        <header className="section-head">
          <h2>Choose your space</h2>
          <p>Availability updates the moment a unit is reserved.</p>
        </header>

        {loading ? (
          <p className="loading">Loading inventory…</p>
        ) : (
          <div className="type-grid">
            {byType.map(([unitType, info]) => (
              <Link
                key={unitType}
                to={`/units?type=${encodeURIComponent(unitType)}`}
                className="type-card"
              >
                <span className="type-card-label">{unitType}</span>
                <span className="type-card-count">
                  {info.count} unit{info.count === 1 ? '' : 's'} available
                </span>
                <span className="type-card-price">
                  from {formatPeso(info.from)}
                </span>
                <span className="type-card-go">View units &rarr;</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------- featured */}
      {featured.length > 0 && (
        <section className="home-section alt">
          <header className="section-head">
            <h2>Featured units</h2>
            <p>The most accessible units currently on the market.</p>
          </header>

          <div className="unit-grid">
            {featured.map((unit) => (
              <Link key={unit.id} to={`/units/${unit.id}`} className="unit-card">
                <div className="unit-card-media">
                  {unit.images[0] ? (
                    <img src={unit.images[0]} alt={`Unit ${unit.unitNo}`} />
                  ) : (
                    <span className="unit-card-type">{unit.type}</span>
                  )}
                  {unit.promo && <span className="unit-promo">{unit.promo}</span>}
                </div>
                <div className="unit-card-body">
                  <h3>Unit {unit.unitNo}</h3>
                  <p className="unit-card-sub">
                    {unit.building} · {unit.floorAreaSqm} sqm · Floor {unit.floor}
                  </p>
                  <p className="unit-card-price">{formatPeso(unit.price)}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="section-foot">
            <Link to="/units" className="btn btn-primary btn-inline">
              See all available units
            </Link>
          </div>
        </section>
      )}

      {/* --------------------------------------------------- amenities */}
      <section className="home-section">
        <header className="section-head">
          <h2>Amenities</h2>
          <p>Shared facilities available to every resident.</p>
        </header>

        <ul className="amenity-grid">
          {[
            'Swimming Pool',
            'Fitness Gym',
            'Function Room',
            'Playground',
            'Sky Garden',
            '24/7 Security',
            'Basement Parking',
            'Convenience Store',
          ].map((amenity) => (
            <li key={amenity}>{amenity}</li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------- how it works */}
      <section className="home-section alt">
        <header className="section-head">
          <h2>How reserving works</h2>
          <p>From browsing to an approved reservation.</p>
        </header>

        <ol className="steps">
          <li>
            <span className="step-no">1</span>
            <h3>Browse</h3>
            <p>View units, floor areas, and prices. No account needed.</p>
          </li>
          <li>
            <span className="step-no">2</span>
            <h3>Register</h3>
            <p>
              Create an account using your name exactly as it appears on your
              valid ID.
            </p>
          </li>
          <li>
            <span className="step-no">3</span>
            <h3>Reserve</h3>
            <p>
              The unit is placed <strong>On Hold</strong> immediately so no one
              else can reserve it while you complete your requirements.
            </p>
          </li>
          <li>
            <span className="step-no">4</span>
            <h3>Upload documents</h3>
            <p>
              Submit your valid ID, proof of billing, income documents, and proof
              of payment. Each file is checked automatically on upload.
            </p>
          </li>
          <li>
            <span className="step-no">5</span>
            <h3>Approval</h3>
            <p>
              Our staff review every document. Once approved, the unit becomes
              yours and your account unlocks the Client Portal.
            </p>
          </li>
        </ol>

        <div className="section-foot">
          <Link to="/register" className="btn btn-gold btn-inline">
            Create an account
          </Link>
        </div>
      </section>
    </div>
  );
}
