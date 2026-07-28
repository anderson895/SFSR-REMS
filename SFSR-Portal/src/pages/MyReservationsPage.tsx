import { COLLECTIONS, type Reservation, db } from '@sfsr/shared';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const STATUS_COPY: Record<string, string> = {
  pending: 'Submitted. Waiting for staff to begin review.',
  under_review: 'Staff are reviewing your documents.',
  approved: 'Approved. The unit is now reserved in your name.',
  rejected: 'Rejected. See the remarks below.',
  cancelled: 'Cancelled. The unit has been returned to the market.',
};

export default function MyReservationsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, COLLECTIONS.RESERVATIONS),
      where('buyerUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setReservations(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reservation),
      );
      setLoading(false);
    });
  }, [user]);

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
        <p>Track the status of each reservation and its requirements.</p>
      </div>

      <div className="stack">
        {reservations.map((reservation) => (
          <article key={reservation.id} className="res-card">
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
                <strong>Remarks:</strong> {reservation.remarks}
              </p>
            )}

            <Link to={`/reservations/${reservation.id}`} className="btn">
              View requirements
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
