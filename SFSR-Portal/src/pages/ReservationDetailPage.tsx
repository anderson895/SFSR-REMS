import {
  COLLECTIONS,
  DOC_TYPE_LABELS,
  DocumentUploader,
  REQUIRED_DOC_TYPES,
  type Reservation,
  ReservationStatus,
  ValidationPanel,
  cancelReservation,
  db,
  fullNameOf,
  requirementProgress,
  useReservationDocuments,
  writeAuditLog,
} from '@sfsr/shared';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ReservationDetailPage() {
  const { reservationId } = useParams();
  const { user } = useAuth();
  // Set by the reserve page when the hold succeeded but the ID upload did not.
  const uploadFailed = (useLocation().state as { uploadFailed?: string } | null)
    ?.uploadFailed;
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // The error is read, not discarded. A failed listener returns an empty list,
  // which is indistinguishable from "nothing uploaded yet" — and telling a
  // buyer their documents are missing when they are merely unreadable sends
  // them to re-upload files that are already there.
  // The uid is passed so the query carries the constraint the rules check —
  // see useReservationDocuments. Without it the server refuses the query.
  const { documents, error: documentsError } = useReservationDocuments(
    reservationId,
    user?.uid,
  );
  const progress = requirementProgress(documents);

  // Same reasoning as the documents listener above, applied to the reservation
  // itself: a failed listener leaves this null, and the page then tells a buyer
  // their reservation does not exist. That is the single most alarming thing
  // this screen can say, and it must not be said on the strength of an error
  // nobody looked at.
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
        setLoadError('');
        setLoading(false);
      },
      (err) => {
        setLoadError(`${err.code}: ${err.message}`);
        setLoading(false);
      },
    );
  }, [reservationId]);

  if (loading) return <p className="loading">Loading reservation…</p>;

  if (!reservation) {
    return (
      <div className="notice">
        <h2>
          {loadError
            ? 'We could not load this reservation'
            : 'Reservation not found'}
        </h2>
        {loadError && (
          <p className="field-error">
            {loadError}. Your reservation has not been affected — please try
            again in a moment.
          </p>
        )}
        <p>
          <Link to="/reservations">Back to my reservations</Link>
        </p>
      </div>
    );
  }

  const { buyer } = reservation;
  const closed =
    reservation.status === ReservationStatus.REJECTED ||
    reservation.status === ReservationStatus.CANCELLED;

  // Withdrawing is the buyer's to make only while the application is still
  // open. Once approved, money and a converted account are involved and the
  // sales office has to handle it.
  const cancellable =
    reservation.status === ReservationStatus.PENDING ||
    reservation.status === ReservationStatus.UNDER_REVIEW;

  async function handleCancel() {
    if (!reservation || !user) return;

    setCancelError('');
    setCancelling(true);
    try {
      await cancelReservation(reservation.id, user.uid, cancelReason.trim());

      await writeAuditLog({
        actorUid: user.uid,
        actorName: fullNameOf(reservation.buyer),
        action: 'reservation.cancelled',
        targetType: 'reservation',
        targetId: reservation.id,
        meta: { unitId: reservation.unitId, by: 'buyer' },
      });

      setConfirmingCancel(false);
    } catch (err) {
      setCancelError(
        (err as Error).message ?? 'Could not cancel this reservation.',
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <Link to="/reservations" className="back-link">
        &larr; Back to my reservations
      </Link>

      <div className="page-head">
        <h1>{reservation.unitLabel}</h1>
        <p>
          Reservation reference <code>{reservation.id.slice(0, 8)}</code>
        </p>
      </div>

      <section className="panel-card">
        <h2>Buyer details</h2>
        <dl className="spec-list">
          <div>
            <dt>Name</dt>
            <dd>
              {[buyer.firstName, buyer.middleName, buyer.lastName]
                .filter(Boolean)
                .join(' ')}
            </dd>
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
            <dt>Status</dt>
            <dd>
              <span className={`status-pill status-res-${reservation.status}`}>
                {reservation.status.replace('_', ' ')}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {uploadFailed && (
        <p className="field-error">
          <strong>Your reservation was created, but the ID did not upload.</strong>{' '}
          {uploadFailed} The unit is held for you — upload your ID below to
          start the review.
        </p>
      )}

      {documentsError && (
        <p className="field-error">
          Your uploaded documents could not be loaded, so the checklist below
          may be incomplete. Refresh the page before uploading anything again.
          ({documentsError})
        </p>
      )}

      <section className="panel-card">
        <h2>
          Requirements checklist ({progress.met}/{progress.total} approved)
        </h2>
        <ul className="checklist">
          {REQUIRED_DOC_TYPES.map((type) => {
            const uploaded = documents.filter((d) => d.docType === type);
            const isApproved = progress.approved.has(type);
            const state = isApproved
              ? 'approved'
              : uploaded.length
                ? 'pending'
                : 'missing';

            return (
              <li key={type} className={`checklist-item is-${state}`}>
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
      </section>

      <section className="panel-card">
        <h2>Upload a document</h2>
        {closed ? (
          <p className="unavailable-note">
            This reservation is {reservation.status}. Uploads are closed.
          </p>
        ) : (
          <DocumentUploader
            reservationId={reservation.id}
            buyerUid={reservation.buyerUid}
            uploadedBy={user?.uid ?? ''}
            uploadedByName={fullNameOf(buyer)}
            registeredName={fullNameOf(buyer)}
          />
        )}
      </section>

      <section className="panel-card">
        <h2>Uploaded documents ({documents.length})</h2>
        {documents.length === 0 ? (
          <p className="hint">You have not uploaded any documents yet.</p>
        ) : (
          <ul className="doc-list">
            {documents.map((document) => (
              <li key={document.id} className="doc-item">
                <div>
                  <strong>{DOC_TYPE_LABELS[document.docType]}</strong>
                  <p className="cell-sub">
                    {(document.sizeBytes / 1024).toFixed(0)} KB &middot;{' '}
                    {document.mimeType}
                  </p>
                </div>
                <div className="doc-item-right">
                  <span className={`status-pill status-doc-${document.status}`}>
                    {document.status}
                  </span>
                  <a
                    href={document.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn"
                  >
                    View
                  </a>
                </div>
                {document.reviewNote && (
                  <p className="res-remarks">
                    <strong>Staff note:</strong> {document.reviewNote}
                  </p>
                )}
                <ValidationPanel document={document} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {cancellable && (
        <section className="panel-card danger-zone">
          <h2>Cancel this reservation</h2>
          <p className="hint">
            Unit {reservation.unitLabel} is currently on hold for you. Cancelling
            releases it immediately and it returns to the public listing, where
            another buyer can reserve it. This cannot be undone.
          </p>

          {cancelError && <p className="field-error">{cancelError}</p>}

          {confirmingCancel ? (
            <>
              <label>
                Reason <span className="optional">(optional)</span>
                <input
                  value={cancelReason}
                  placeholder="e.g. changed my mind about the floor"
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </label>
              <div className="danger-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={cancelling}
                  onClick={() => void handleCancel()}
                >
                  {cancelling ? 'Cancelling…' : 'Yes, release the unit'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={cancelling}
                  onClick={() => setConfirmingCancel(false)}
                >
                  Keep my reservation
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel reservation
            </button>
          )}
        </section>
      )}
    </>
  );
}
