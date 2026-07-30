import {
  COLLECTIONS,
  MAX_UNIT_TYPES,
  ReservationSource,
  type Unit,
  UnitStatus,
  type UnitType,
  UnitUnavailableError,
  createReservation,
  db,
  fullNameOf,
  writeAuditLog,
} from '@sfsr/shared';
import {
  collection,
  limit,
  onSnapshot,
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

  /**
   * The unit is chosen by narrowing: type, then floor, then unit.
   *
   * A single dropdown of every available unit was both the most expensive screen
   * in the system and the least usable one. It read all 317 available units on
   * every page load -- and on every hot reload during development -- and then
   * asked staff to find one by scrolling a 317-item list.
   *
   * Narrowing costs four type documents plus the handful of units on the chosen
   * floor: about eight reads instead of 317, and the choice a person actually
   * makes ("a 1BR on the twelfth") maps onto the controls.
   */
  const [types, setTypes] = useState<UnitType[]>([]);
  const [typeId, setTypeId] = useState('');
  const [floor, setFloor] = useState('');

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState('');
  const [unitId, setUnitId] = useState('');
  const [buyer, setBuyer] = useState(EMPTY_BUYER);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedType = types.find((t) => t.id === typeId);

  /**
   * Floors come from the type document, not from a query.
   *
   * `lowestFloor` and `highestFloor` are stored on the type, so the whole floor
   * list costs nothing to build.
   */
  const floors = selectedType
    ? Array.from(
        { length: selectedType.highestFloor - selectedType.lowestFloor + 1 },
        (_, i) => selectedType.lowestFloor + i,
      )
    : [];

  useEffect(() => {
    // The error callback is not optional. Without it a failed listener -- a
    // missing composite index, a rules rejection -- renders as a silently empty
    // dropdown that looks exactly like "no units exist".
    return onSnapshot(
      query(collection(db, COLLECTIONS.UNIT_TYPES), limit(MAX_UNIT_TYPES)),
      (snap) =>
        setTypes(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as UnitType)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        ),
      (err) => setUnitsError(`${err.code}: ${err.message}`),
    );
  }, []);

  // Only the units on the chosen floor of the chosen type are fetched.
  useEffect(() => {
    setUnitId('');
    if (!typeId || !floor) {
      setUnits([]);
      return;
    }

    setUnitsLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.UNITS),
        where('typeId', '==', typeId),
        where('status', '==', UnitStatus.AVAILABLE),
        where('floor', '==', Number(floor)),
        limit(20),
      ),
      (snap) => {
        setUnits(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Unit)
            .sort((a, b) => a.unitNo.localeCompare(b.unitNo)),
        );
        setUnitsError('');
        setUnitsLoading(false);
      },
      (err) => {
        setUnitsError(`${err.code}: ${err.message}`);
        setUnitsLoading(false);
      },
    );
  }, [typeId, floor]);

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

        <div className="form-row">
          <label>
            Unit type
            <select
              value={typeId}
              onChange={(e) => {
                setTypeId(e.target.value);
                setFloor('');
              }}
              required
            >
              <option value="">Select a unit type…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.type} — {t.floorAreaSqm} sqm ({t.projectName})
                </option>
              ))}
            </select>
          </label>

          <label>
            Floor
            <select
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              required
              disabled={!selectedType}
            >
              <option value="">
                {selectedType ? 'Select a floor…' : 'Choose a type first'}
              </option>
              {floors.map((f) => (
                <option key={f} value={f}>
                  Floor {f}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Unit
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
            disabled={!floor || unitsLoading}
          >
            <option value="">
              {!floor
                ? 'Choose a floor first'
                : unitsLoading
                  ? 'Loading units…'
                  : units.length
                    ? 'Select an available unit…'
                    : 'No available units on this floor'}
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                Unit {unit.unitNo} — ₱{unit.price.toLocaleString('en-PH')}
              </option>
            ))}
          </select>
        </label>

        {floor && !unitsLoading && !unitsError && units.length === 0 && (
          <p className="hint">
            Every unit of this type on floor {floor} is already reserved, on hold,
            or sold. Try another floor.
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
