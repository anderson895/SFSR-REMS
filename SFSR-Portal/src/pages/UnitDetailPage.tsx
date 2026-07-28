import { UnitStatus } from '@sfsr/shared';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { formatPeso, useUnit } from '../units/useUnits';

export default function UnitDetailPage() {
  const { unitId } = useParams();
  const { unit, loading } = useUnit(unitId);
  const { user } = useAuth();

  if (loading) return <p className="loading">Loading unit…</p>;

  if (!unit) {
    return (
      <div className="notice">
        <h2>Unit not found</h2>
        <p>
          <Link to="/units">Back to available units</Link>
        </p>
      </div>
    );
  }

  const available = unit.status === UnitStatus.AVAILABLE;

  return (
    <article className="unit-detail">
      <Link to="/units" className="back-link">
        &larr; Back to available units
      </Link>

      <header className="unit-detail-head">
        <div>
          <h1>Unit {unit.unitNo}</h1>
          <p className="unit-card-sub">
            {unit.projectName} &middot; {unit.building}
          </p>
        </div>
        <span className={`status-pill status-${unit.status}`}>
          {unit.status.replace('_', ' ')}
        </span>
      </header>

      <div className="unit-detail-grid">
        <section>
          <div className="unit-hero">
            {unit.images[0] ? (
              <img src={unit.images[0]} alt={`Unit ${unit.unitNo}`} />
            ) : (
              <span>{unit.type}</span>
            )}
          </div>

          <h2>About this unit</h2>
          <p>{unit.description}</p>

          <h2>Amenities</h2>
          <ul className="amenities">
            {unit.amenities.map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>

          {unit.floorPlanUrl && (
            <>
              <h2>Floor plan</h2>
              <img
                src={unit.floorPlanUrl}
                alt="Floor plan"
                className="floor-plan"
              />
            </>
          )}
        </section>

        <aside className="unit-aside">
          <p className="unit-price-big">{formatPeso(unit.price)}</p>
          {unit.promo && <p className="unit-promo-inline">{unit.promo}</p>}

          <dl className="spec-list">
            <div>
              <dt>Type</dt>
              <dd>{unit.type}</dd>
            </div>
            <div>
              <dt>Floor area</dt>
              <dd>{unit.floorAreaSqm} sqm</dd>
            </div>
            <div>
              <dt>Floor</dt>
              <dd>{unit.floor}</dd>
            </div>
            <div>
              <dt>Tower</dt>
              <dd>{unit.building}</dd>
            </div>
          </dl>

          {available ? (
            <Link
              to={user ? `/units/${unit.id}/reserve` : '/login'}
              state={user ? undefined : { from: `/units/${unit.id}/reserve` }}
              className="btn btn-primary btn-block"
            >
              {user ? 'Reserve this unit' : 'Sign in to reserve'}
            </Link>
          ) : (
            <p className="unavailable-note">
              This unit is no longer available for reservation.
            </p>
          )}
        </aside>
      </div>
    </article>
  );
}
