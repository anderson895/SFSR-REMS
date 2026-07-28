import {
  DOC_TYPE_LABELS,
  type DocumentRecord,
  DocumentStatus,
  ValidationPanel,
  fetchStoredFile,
  fullNameOf,
  reviewDocument,
  useDocumentAnalysis,
  writeAuditLog,
} from '@sfsr/shared';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

interface Props {
  document: DocumentRecord;
  /** The buyer's registered name from the reservation, for Stage 2 matching. */
  registeredName: string;
}

/**
 * One document in the staff review queue: the file, what OCR read, what the
 * Levenshtein comparison concluded, and the accept/reject decision.
 */
export default function DocumentReviewItem({ document, registeredName }: Props) {
  const { user, profile } = useAuth();
  const analysis = useDocumentAnalysis();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const decided = document.status !== DocumentStatus.PENDING;

  /**
   * Re-runs OCR on a file the buyer uploaded from their own device.
   *
   * The original File only existed in the buyer's browser, so the stored copy
   * is pulled back from Cloudinary first. This also lets staff re-scan after a
   * poor first read without asking the buyer to upload again.
   */
  async function handleRescan() {
    setError('');
    try {
      const file = await fetchStoredFile(document.fileUrl, document.mimeType);
      await analysis.analyze(
        document.id,
        file,
        document.docType,
        registeredName,
      );

      if (user) {
        await writeAuditLog({
          actorUid: user.uid,
          actorName: profile ? fullNameOf(profile) : 'staff',
          action: 'document.rescanned',
          targetType: 'document',
          targetId: document.id,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function decide(status: Exclude<DocumentStatus, 'pending'>) {
    if (!user) return;

    const note =
      status === DocumentStatus.REJECTED
        ? (window.prompt('Reason for rejecting this document:') ?? '')
        : '';
    if (status === DocumentStatus.REJECTED && note === '') return;

    setError('');
    setBusy(true);
    try {
      await reviewDocument(document.id, status, user.uid, note);
      await writeAuditLog({
        actorUid: user.uid,
        actorName: profile ? fullNameOf(profile) : 'staff',
        action:
          status === DocumentStatus.APPROVED
            ? 'document.approved'
            : 'document.rejected',
        targetType: 'document',
        targetId: document.id,
        meta: { docType: document.docType, note },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="review-item">
      <header className="review-head">
        <div>
          <h3>{DOC_TYPE_LABELS[document.docType]}</h3>
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
            Open file
          </a>
        </div>
      </header>

      {error && <p className="field-error">{error}</p>}

      {analysis.running ? (
        <div className="ocr-status">
          <div className="progress">
            <div
              className="progress-bar is-ocr"
              style={{ width: `${Math.round(analysis.progress * 100)}%` }}
            />
            <span>{Math.round(analysis.progress * 100)}%</span>
          </div>
          <p>Running OCR — {analysis.phase}…</p>
        </div>
      ) : (
        <ValidationPanel document={document} />
      )}

      {analysis.error && <p className="field-error">{analysis.error}</p>}

      <div className="action-bar">
        <button
          type="button"
          className="btn"
          disabled={analysis.running || busy}
          onClick={() => void handleRescan()}
        >
          {document.ocr ? 'Re-scan' : 'Run OCR'}
        </button>

        {!decided && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || analysis.running}
              onClick={() => void decide(DocumentStatus.APPROVED)}
            >
              Approve document
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || analysis.running}
              onClick={() => void decide(DocumentStatus.REJECTED)}
            >
              Reject
            </button>
          </>
        )}
      </div>

      {document.reviewNote && (
        <p className="res-remarks">
          <strong>Review note:</strong> {document.reviewNote}
        </p>
      )}
    </article>
  );
}
