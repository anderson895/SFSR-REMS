import {
  COLLECTIONS,
  DOC_TYPE_LABELS,
  DocumentUploader,
  REQUIRED_DOC_TYPES,
  type Reservation,
  ReservationStatus,
  ValidationPanel,
  db,
  fullNameOf,
  requirementProgress,
  useReservationDocuments,
} from '@sfsr/shared';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ReservationDetailPage() {
  const { reservationId } = useParams();
  const { user } = useAuth();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);

  const { documents } = useReservationDocuments(reservationId);
  const progress = requirementProgress(documents);

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

  if (loading) return <p className="loading">Loading reservation…</p>;

  if (!reservation) {
    return (
      <div className="notice">
        <h2>Reservation not found</h2>
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
    </>
  );
}
