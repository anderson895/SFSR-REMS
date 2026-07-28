import {
  ReservationSource,
  UnitStatus,
  UnitUnavailableError,
  createReservation,
  fullNameOf,
  writeAuditLog,
} from '@sfsr/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { formatPeso, useUnit } from '../units/useUnits';

/**
 * Online reservation.
 *
 * The buyer's details are pre-filled from their profile but stay editable, and
 * a snapshot is stored on the reservation. Keeping a copy means the record
 * still shows who reserved and under what details even if the buyer later edits
 * their profile — important for a document trail that has to stand up to audit.
 */
export default function ReservePage() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { unit, loading } = useUnit(unitId);

  const [buyer, setBuyer] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    mobile: '',
    address: '',
    idNumber: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setBuyer({
      firstName: profile.firstName ?? '',
      middleName: profile.middleName ?? '',
      lastName: profile.lastName ?? '',
      email: profile.email ?? '',
      mobile: profile.mobile ?? '',
      address: profile.address ?? '',
      idNumber: '',
    });
  }, [profile]);

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

  if (unit.status !== UnitStatus.AVAILABLE) {
    return (
      <div className="notice notice-error">
        <h2>This unit is no longer available</h2>
        <p>
          Unit {unit.unitNo} is currently marked{' '}
          <strong>{unit.status.replace('_', ' ')}</strong>. Someone may have
          reserved it first.
        </p>
        <Link to="/units" className="btn">
          See other units
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !unit) return;

    setError('');
    setBusy(true);
    try {
      const reservationId = await createReservation({
        unitId: unit.id,
        buyer,
        buyerUid: user.uid,
        source: ReservationSource.ONLINE,
        createdBy: user.uid,
      });

      await writeAuditLog({
        actorUid: user.uid,
        actorName: fullNameOf(buyer),
        action: 'reservation.created',
        targetType: 'reservation',
        targetId: reservationId,
        meta: { unitId: unit.id, unitNo: unit.unitNo, source: 'online' },
      });

      navigate('/reservations', { replace: true });
    } catch (err) {
      // The transaction lost a race with another buyer, or the unit changed
      // status between page load and submission.
      setError(
        err instanceof UnitUnavailableError
          ? err.message
          : ((err as Error).message ?? 'Could not complete the reservation.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card form-card-wide">
      <h1>Reserve Unit {unit.unitNo}</h1>
      <p className="form-sub">
        {unit.building} &middot; {unit.type} &middot; {unit.floorAreaSqm} sqm
        &middot; {formatPeso(unit.price)}
      </p>

      <div className="account-badge is-initial">
        <strong>What happens next</strong>
        <span>
          Submitting places this unit <b>On Hold</b> so no one else can reserve
          it. You then upload your requirements, and staff review them before
          the reservation is approved.
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <p className="field-error">{error}</p>}

        <div className="form-row">
          <label>
            First name
            <input
              value={buyer.firstName}
              required
              onChange={(e) => setBuyer({ ...buyer, firstName: e.target.value })}
            />
          </label>
          <label>
            Middle name
            <input
              value={buyer.middleName}
              onChange={(e) =>
                setBuyer({ ...buyer, middleName: e.target.value })
              }
            />
          </label>
          <label>
            Last name
            <input
              value={buyer.lastName}
              required
              onChange={(e) => setBuyer({ ...buyer, lastName: e.target.value })}
            />
          </label>
        </div>

        <p className="hint">
          Your name must match your government-issued ID. Uploaded documents are
          validated against these details.
        </p>

        <div className="form-row">
          <label>
            Email address
            <input
              type="email"
              value={buyer.email}
              required
              onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
            />
          </label>
          <label>
            Mobile number
            <input
              value={buyer.mobile}
              required
              onChange={(e) => setBuyer({ ...buyer, mobile: e.target.value })}
            />
          </label>
        </div>

        <label>
          Present address
          <input
            value={buyer.address}
            required
            onChange={(e) => setBuyer({ ...buyer, address: e.target.value })}
          />
        </label>

        <label>
          Government ID number <span className="optional">(optional)</span>
          <input
            value={buyer.idNumber}
            onChange={(e) => setBuyer({ ...buyer, idNumber: e.target.value })}
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Reserving…' : 'Submit reservation'}
        </button>
      </form>
    </div>
  );
}
