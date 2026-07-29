import {
  COLLECTIONS,
  type Reservation,
  ReservationStatus,
  db,
  formatDate,
  formatTime,
} from '@sfsr/shared';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const ALL = 'all';

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Capped: an unbounded live listener re-reads every reservation on each
    // attach, which during development means on every hot reload.
    const q = query(
      collection(db, COLLECTIONS.RESERVATIONS),
      orderBy('createdAt', 'desc'),
      limit(200),
    );
    // Without an error callback a failed listener looks like an empty queue.
    return onSnapshot(
      q,
      (snap) => {
        setReservations(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reservation),
        );
        setLoading(false);
      },
      (err) => {
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      },
    );
  }, []);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const r of reservations) tally[r.status] = (tally[r.status] ?? 0) + 1;
    return tally;
  }, [reservations]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (status !== ALL && r.status !== status) return false;
      if (!needle) return true;
      const name = `${r.buyer.firstName} ${r.buyer.lastName}`.toLowerCase();
      return (
        name.includes(needle) ||
        r.unitLabel.toLowerCase().includes(needle) ||
        r.buyer.email.toLowerCase().includes(needle)
      );
    });
  }, [reservations, status, search]);

  if (loading) return <p className="loading">Loading reservations…</p>;

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1>Reservations</h1>
            <p>
              {counts[ReservationStatus.PENDING] ?? 0} pending &middot;{' '}
              {counts[ReservationStatus.UNDER_REVIEW] ?? 0} under review &middot;{' '}
              {counts[ReservationStatus.APPROVED] ?? 0} approved
            </p>
          </div>
          <Link to="/reservations/new" className="btn btn-primary">
            New walk-in reservation
          </Link>
        </div>

        {error && (
          <p className="field-error">Could not load reservations — {error}</p>
        )}

        <div className="filters">
          <input
            type="search"
            placeholder="Search buyer, email, or unit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={ALL}>All statuses</option>
            {Object.values(ReservationStatus).map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Buyer</th>
              <th>Reserved on</th>
              <th>Source</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  No reservations match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.unitLabel}</td>
                  <td>
                    {r.buyer.firstName} {r.buyer.lastName}
                    <br />
                    <span className="cell-sub">{r.buyer.email}</span>
                  </td>
                  <td className="nowrap">
                    {/* `reservationDate` is the business fact — when the buyer
                        reserved. `createdAt` is the fallback for any record
                        written before that field existed. */}
                    {formatDate(r.reservationDate ?? r.createdAt)}
                    <br />
                    <span className="cell-sub">
                      {formatTime(r.reservationDate ?? r.createdAt)}
                    </span>
                  </td>
                  <td>
                    <span className="tag">
                      {r.source === 'walkin' ? 'Walk-in' : 'Online'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill status-res-${r.status}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <Link to={`/reservations/${r.id}`} className="btn">
                      Review
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
