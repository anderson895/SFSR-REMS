import {
  COLLECTIONS,
  DOC_TYPE_LABELS,
  DocumentUploader,
  REQUIRED_DOC_TYPES,
  type Reservation,
  ReservationStatus,
  Role,
  type Unit,
  approveReservation,
  cancelReservation,
  db,
  fullNameOf,
  rejectReservation,
  requestAdditionalDocuments,
  requirementProgress,
  useReservationDocuments,
  writeAuditLog,
} from '@sfsr/shared';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import DocumentReviewItem from '../components/DocumentReviewItem';

export default function ReservationDetailPage() {
  const { reservationId } = useParams();
  const { user, profile } = useAuth();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(false);

  const { documents } = useReservationDocuments(reservationId);
  const progress = requirementProgress(documents);
  const isAdmin = profile?.role === Role.ADMIN;

  useEffect(() => {
    if (!reservationId) return;
    return onSnapshot(
      doc(db, COLLECTIONS.RESERVATIONS, reservationId),
      (snap) => {
        setReservation(
          snap.exists()
            ? ({ id: snap.id, ...snap.data() } as Reservation)
            : null,
        );
        setLoading(false);
      },
    );
  }, [reservationId]);

  useEffect(() => {
    if (!reservation?.unitId) return;
    return onSnapshot(doc(db, COLLECTIONS.UNITS, reservation.unitId), (snap) =>
      setUnit(snap.exists() ? ({ id: snap.id, ...snap.data() } as Unit) : null),
    );
  }, [reservation?.unitId]);

  if (loading) return <p className="loading">Loading reservation…</p>;

  if (!reservation) {
    return (
      <div className="notice">
        <h2>Reservation not found</h2>
        <p>
          <Link to="/reservations">Back to reservations</Link>
        </p>
      </div>
    );
  }

  const decided =
    reservation.status === ReservationStatus.APPROVED ||
    reservation.status === ReservationStatus.REJECTED ||
    reservation.status === ReservationStatus.CANCELLED;

  async function handleApprove() {
    if (!user || !reservation) return;
    setError('');
    setBusy(true);
    try {
      await approveReservation(reservation.id, user.uid);
      await writeAuditLog({
        actorUid: user.uid,
        actorName: profile ? fullNameOf(profile) : 'staff',
        action: 'reservation.approved',
        targetType: 'reservation',
        targetId: reservation.id,
        meta: {
          unitId: reservation.unitId,
          requirementsMet: `${progress.met}/${progress.total}`,
          // Recorded so an approval made over an incomplete checklist is
          // traceable to the person who authorised it.
          overrodeIncompleteRequirements: !progress.complete,
        },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestDocuments() {
    if (!user || !reservation) return;

    const suggested = progress.missing
      .map((type) => DOC_TYPE_LABELS[type])
      .join(', ');
    const message = window.prompt(
      'What does the buyer still need to submit?',
      suggested ? `Please submit: ${suggested}.` : '',
    );
    if (message === null || message.trim() === '') return;

    setError('');
    setBusy(true);
    try {
      await requestAdditionalDocuments(reservation.id, user.uid, message);
      await writeAuditLog({
        actorUid: user.uid,
        actorName: profile ? fullNameOf(profile) : 'staff',
        action: 'reservation.documents_requested',
        targetType: 'reservation',
        targetId: reservation.id,
        meta: { message },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!user || !reservation) return;
    const reason = window.prompt('Reason for rejection (shown to the buyer):');
    if (reason === null) return;

    setError('');
    setBusy(true);
    try {
      await rejectReservation(reservation.id, user.uid, reason);
      await writeAuditLog({
        actorUid: user.uid,
        actorName: profile ? fullNameOf(profile) : 'staff',
        action: 'reservation.rejected',
        targetType: 'reservation',
        targetId: reservation.id,
        meta: { unitId: reservation.unitId, reason },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Releases the hold on the buyer's behalf.
   *
   * Distinct from Reject: rejection is the company turning an application down
   * and is recorded as such, whereas this is the buyer withdrawing — usually
   * phoned in — and must not appear in the trail as a company decision.
   */
  async function handleCancel() {
    if (!user || !reservation) return;
    const reason = window.prompt(
      'Cancelling on the buyer\'s behalf releases the unit back to the market.\n\n' +
        'Reason (shown to the buyer):',
    );
    if (reason === null) return;

    setError('');
    setBusy(true);
    try {
      await cancelReservation(reservation.id, user.uid, reason);
      await writeAuditLog({
        actorUid: user.uid,
        actorName: profile ? fullNameOf(profile) : 'staff',
        action: 'reservation.cancelled',
        targetType: 'reservation',
        targetId: reservation.id,
        meta: { unitId: reservation.unitId, reason, by: 'staff' },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const { buyer } = reservation;

  return (
    <div className="stack">
      <Link to="/reservations" className="back-link">
        &larr; Back to reservations
      </Link>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h1>{reservation.unitLabel}</h1>
            <p>
              {reservation.source === 'walkin' ? 'Walk-in' : 'Online'}{' '}
              reservation &middot; ref <code>{reservation.id.slice(0, 8)}</code>
            </p>
          </div>
          <span className={`status-pill status-res-${reservation.status}`}>
            {reservation.status.replace('_', ' ')}
          </span>
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="two-col">
          <div>
            <h2>Buyer</h2>
            <dl className="spec-list">
              <div>
                <dt>Name</dt>
                <dd>{fullNameOf(buyer)}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{buyer.email}</dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>{buyer.mobile || '—'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{buyer.address || '—'}</dd>
              </div>
              <div>
                <dt>ID number</dt>
                <dd>{buyer.idNumber || '—'}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2>Unit</h2>
            <dl className="spec-list">
              <div>
                <dt>Unit</dt>
                <dd>{unit ? `${unit.building} — ${unit.unitNo}` : '—'}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{unit?.type ?? '—'}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>
                  {unit ? `₱${unit.price.toLocaleString('en-PH')}` : '—'}
                </dd>
              </div>
              <div>
                <dt>Unit status</dt>
                <dd>
                  {unit && (
                    <span className={`status-pill status-${unit.status}`}>
                      {unit.status.replace('_', ' ')}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {reservation.remarks && (
          <p className="res-remarks">
            <strong>Remarks:</strong> {reservation.remarks}
          </p>
        )}

        {!decided && (
          <>
            {!progress.complete && (
              <div className="approval-block">
                <strong>
                  Requirements incomplete — {progress.met} of {progress.total}{' '}
                  approved
                </strong>
                <p>
                  Still needed:{' '}
                  {progress.missing
                    .map((type) => DOC_TYPE_LABELS[type])
                    .join(', ')}
                  .
                </p>
                {isAdmin && (
                  <label className="override">
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={(e) => setOverride(e.target.checked)}
                    />
                    Approve anyway on management authority (recorded in the
                    audit trail)
                  </label>
                )}
              </div>
            )}

            <div className="action-bar">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || (!progress.complete && !override)}
                onClick={() => void handleApprove()}
              >
                {busy ? 'Working…' : 'Approve reservation'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void handleRequestDocuments()}
              >
                Request additional documents
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void handleReject()}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void handleCancel()}
              >
                Cancel for buyer
              </button>
            </div>
          </>
        )}

        {reservation.status === ReservationStatus.APPROVED && (
          <p className="field-note">
            Approved. The unit is now marked Reserved and has been removed from
            the portal's available listings.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>
          Documentary requirements ({progress.met}/{progress.total} approved)
        </h2>

        <ul className="checklist">
          {REQUIRED_DOC_TYPES.map((type) => {
            const uploaded = documents.filter((d) => d.docType === type);
            const isApproved = progress.approved.has(type);
            return (
              <li
                key={type}
                className={`checklist-item is-${
                  isApproved ? 'approved' : uploaded.length ? 'pending' : 'missing'
                }`}
              >
                <span className="checklist-mark">
                  {isApproved ? '✓' : uploaded.length ? '•' : '○'}
                </span>
                <span>{DOC_TYPE_LABELS[type]}</span>
                <span className="checklist-state">
                  {isApproved
                    ? 'Approved'
                    : uploaded.length
                      ? 'Awaiting review'
                      : 'Not uploaded'}
                </span>
              </li>
            );
          })}
        </ul>

        <h3>Upload on behalf of the buyer</h3>
        <p className="hint">
          For walk-in buyers who submitted printed or scanned documents.
        </p>
        <DocumentUploader
          reservationId={reservation.id}
          buyerUid={reservation.buyerUid}
          uploadedBy={user?.uid ?? ''}
          uploadedByName={profile ? fullNameOf(profile) : 'staff'}
          registeredName={fullNameOf(reservation.buyer)}
        />
      </section>

      <section className="panel">
        <h2>Document review ({documents.length})</h2>
        {documents.length === 0 ? (
          <p className="hint">Nothing uploaded yet.</p>
        ) : (
          <div className="review-list">
            {documents.map((document) => (
              <DocumentReviewItem
                key={document.id}
                document={document}
                registeredName={fullNameOf(reservation.buyer)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
