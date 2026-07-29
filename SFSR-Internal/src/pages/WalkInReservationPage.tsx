import {
  COLLECTIONS,
  ReservationSource,
  type Unit,
  UnitStatus,
  UnitUnavailableError,
  createReservation,
  db,
  fullNameOf,
  writeAuditLog,
} from '@sfsr/shared';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const EMPTY_BUYER = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  mobile: '',
  address: '',
  idNumber: '',
};

/**
 * Walk-in reservation, filed by staff on behalf of a buyer who came to the
 * office.
 *
 * Uses the same `createReservation` transaction as the online path, so a
 * walk-in and an online reservation racing for the same unit still resolve to
 * exactly one hold.
 */
export default function WalkInReservationPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState('');
  const [unitId, setUnitId] = useState('');
  const [buyer, setBuyer] = useState(EMPTY_BUYER);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.UNITS),
      where('status', '==', UnitStatus.AVAILABLE),
      orderBy('price'),
    );
    // The error callback is not optional. Without it a failed listener — a
    // missing composite index, a rules rejection — renders as a silently empty
    // dropdown that looks exactly like "no units exist".
    return onSnapshot(
      q,
      (snap) => {
        setUnits(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Unit));
        setUnitsLoading(false);
      },
      (err) => {
        setUnitsError(`${err.code}: ${err.message}`);
        setUnitsLoading(false);
      },
    );
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    if (!unitId) {
      setError('Select a unit.');
      return;
    }

    setError('');
    setBusy(true);
    try {
      const reservationId = await createReservation({
        unitId,
        buyer,
        // Walk-in buyers have no portal account yet.
        buyerUid: null,
        source: ReservationSource.WALK_IN,
        createdBy: user.uid,
        remarks,
      });

      await writeAuditLog({
        actorUid: user.uid,
        actorName: profile ? fullNameOf(profile) : 'staff',
        action: 'reservation.created',
        targetType: 'reservation',
        targetId: reservationId,
        meta: { unitId, source: 'walkin', buyer: fullNameOf(buyer) },
      });

      navigate(`/reservations/${reservationId}`, { replace: true });
    } catch (err) {
      setError(
        err instanceof UnitUnavailableError
          ? err.message
          : ((err as Error).message ?? 'Could not create the reservation.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h1>New walk-in reservation</h1>
      <p>
        For buyers who reserve in person. Saving places the unit On Hold
        immediately.
      </p>

      <form onSubmit={handleSubmit} className="inline-form">
        {error && <p className="field-error">{error}</p>}

        {unitsError && (
          <p className="field-error">
            Could not load units — {unitsError}
          </p>
        )}

        <label>
          Unit ({unitsLoading ? 'loading…' : `${units.length} available`})
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
            <option value="">
              {unitsLoading ? 'Loading units…' : 'Select an available unit…'}
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.projectName} — Unit {unit.unitNo} ({unit.type}, ₱
                {unit.price.toLocaleString('en-PH')})
              </option>
            ))}
          </select>
        </label>

        {!unitsLoading && !unitsError && units.length === 0 && (
          <p className="hint">
            No units are currently available. Run <code>npm run migrate</code> to
            seed the inventory, or free up a unit first.
          </p>
        )}

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
          Encode the name exactly as printed on the buyer's ID. Uploaded
          documents are validated against these details using Levenshtein
          Distance.
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

        <div className="form-row">
          <label>
            Present address
            <input
              value={buyer.address}
              required
              onChange={(e) => setBuyer({ ...buyer, address: e.target.value })}
            />
          </label>
          <label>
            Government ID number
            <input
              value={buyer.idNumber}
              onChange={(e) => setBuyer({ ...buyer, idNumber: e.target.value })}
            />
          </label>
        </div>

        <label>
          Remarks
          <input
            value={remarks}
            placeholder="Agent, broker, or other notes"
            onChange={(e) => setRemarks(e.target.value)}
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Create reservation and hold unit'}
        </button>
      </form>
    </section>
  );
}
