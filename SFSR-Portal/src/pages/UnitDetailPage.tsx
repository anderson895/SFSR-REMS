import { UnitStatus } from '@sfsr/shared';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { formatPeso, useUnit } from '../units/useUnits';

export default function UnitDetailPage() {
  const { unitId } = useParams();
  // Amenities, images, and the floor plan live on the project and the type now,
  // so the page reads all three rather than copies held on every unit.
  const { unit, project, unitType, loading } = useUnit(unitId);
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
          {/* A single-tower development names its tower after itself, so
              printing both reads as "The Legaspi Place · The Legaspi Place". */}
          <p className="unit-card-sub">
            {[
              unit.projectName,
              project?.building === unit.projectName ? '' : (project?.building ?? ''),
              project?.location ?? '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <span className={`status-pill status-${unit.status}`}>
          {unit.status.replace('_', ' ')}
        </span>
      </header>

      <div className="unit-detail-grid">
        <section>
          <div className="unit-hero">
            {unitType?.images?.[0] ? (
              <img src={unitType.images[0]} alt={`Unit ${unit.unitNo}`} />
            ) : (
              <span>{unit.type}</span>
            )}
          </div>

          <h2>About this unit</h2>
          <p>{unitType?.description}</p>

          <h2>Amenities</h2>
          <ul className="amenities">
            {(project?.amenities ?? []).map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>

          {unitType?.floorPlanUrl && (
            <>
              <h2>Floor plan</h2>
              <img
                src={unitType.floorPlanUrl}
                alt="Floor plan"
                className="floor-plan"
              />
            </>
          )}
        </section>

        <aside className="unit-aside">
          <p className="unit-price-big">{formatPeso(unit.price)}</p>
          {unitType?.promo && (
            <p className="unit-promo-inline">{unitType.promo}</p>
          )}

          <dl className="spec-list">
            <div>
              <dt>Type</dt>
              <dd>{unit.type}</dd>
            </div>
            <div>
              <dt>Floor area</dt>
              <dd>{unitType?.floorAreaSqm ?? '—'} sqm</dd>
            </div>
            <div>
              <dt>Floor</dt>
              <dd>{unit.floor}</dd>
            </div>
            {project && project.building !== unit.projectName && (
              <div>
                <dt>Tower</dt>
                <dd>{project.building}</dd>
              </div>
            )}
            {project?.location && (
              <div>
                <dt>Location</dt>
                <dd>{project.location}</dd>
              </div>
            )}
          </dl>

          {available ? (
            <Link
              to={user ? `/units/${unit.id}/reserve` : '/login'}
              state={user ? undefined : { from: `/units/${unit.id}/reserve` }}
              className="btn btn-primary btn-block"
            >
              {user ? 'Reserve this unit' : 'Sign in to reserve'}
            </Link>
          ) : unit.status === UnitStatus.ON_HOLD ? (
            <div className="hold-note">
              <strong>On hold</strong>
              <p>
                Another buyer has reserved this unit and their documents are
                being reviewed. If that reservation is rejected or cancelled,
                the unit returns to the listing automatically.
              </p>
            </div>
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
