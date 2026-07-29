import { ExclamationCircleIcon } from '@heroicons/react/24/solid';
import { Link } from 'react-router-dom';
import {
  useActionItems,
  useMyReservations,
} from '../reservations/useMyReservations';

const STATUS_COPY: Record<string, string> = {
  pending: 'Submitted. Waiting for staff to begin review.',
  under_review: 'Staff are reviewing your documents.',
  approved: 'Approved. The unit is now reserved in your name.',
  rejected: 'Rejected. See the remarks below.',
  cancelled: 'Cancelled. The unit has been returned to the market.',
};

export default function MyReservationsPage() {
  const { reservations, loading } = useMyReservations();
  const actions = useActionItems();

  if (loading) return <p className="loading">Loading your reservations…</p>;

  if (reservations.length === 0) {
    return (
      <div className="notice">
        <h2>No reservations yet</h2>
        <p>Browse the available units to make your first reservation.</p>
        <Link to="/units" className="btn">
          Browse units
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>My reservations</h1>
        <p>
          {actions.count > 0 ? (
            <>
              <strong>{actions.count}</strong> need
              {actions.count === 1 ? 's' : ''} something from you.
            </>
          ) : (
            'Track the status of each reservation and its requirements.'
          )}
        </p>
      </div>

      <div className="stack">
        {reservations.map((reservation) => {
          const needsAction = actions.flagged.has(reservation.id);
          const rejected = actions.rejectedFor(reservation.id);

          return (
            <article
              key={reservation.id}
              className={`res-card${needsAction ? ' needs-action' : ''}`}
            >
              <header>
                <div>
                  <h2>{reservation.unitLabel}</h2>
                  <p className="unit-card-sub">
                    Reserved by {reservation.buyer.firstName}{' '}
                    {reservation.buyer.lastName}
                  </p>
                </div>
                <span className={`status-pill status-res-${reservation.status}`}>
                  {reservation.status.replace('_', ' ')}
                </span>
              </header>

              <p className="res-status-copy">
                {STATUS_COPY[reservation.status] ?? ''}
              </p>

              {reservation.remarks && (
                <p className="res-remarks">
                  {/* The badge sits on the remark itself: that is the thing
                      being flagged, and it is what the buyer has to act on. */}
                  {needsAction && (
                    <span className="action-badge">
                      <ExclamationCircleIcon className="icon" />
                      Action needed
                    </span>
                  )}
                  <strong>Remarks:</strong> {reservation.remarks}
                </p>
              )}

              {rejected > 0 && (
                <p className="res-remarks">
                  <span className="action-badge">
                    <ExclamationCircleIcon className="icon" />
                    {rejected} document{rejected === 1 ? '' : 's'} rejected
                  </span>
                  Open the reservation to see why and upload a replacement.
                </p>
              )}

              <Link to={`/reservations/${reservation.id}`} className="btn">
                View requirements
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
