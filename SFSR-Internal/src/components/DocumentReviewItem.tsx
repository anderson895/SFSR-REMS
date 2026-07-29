import {
  DOC_TYPE_LABELS,
  ID_TYPE_LABELS,
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
import { usePromptDialog } from './PromptDialog';

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
  const { prompt, dialog } = usePromptDialog();

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
      // The ID subtype recorded at upload is passed back in, so a re-scan is
      // held to the same standard as the original. Dropping it would quietly
      // make the staff re-check weaker than the buyer's own upload.
      await analysis.analyze(document.id, {
        file,
        docType: document.docType,
        idType: document.idType,
        registeredName,
      });

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

    let note = '';
    if (status === DocumentStatus.REJECTED) {
      const reason = await prompt({
        title: `Reject this ${DOC_TYPE_LABELS[document.docType]}?`,
        message:
          'The buyer sees this note and can upload a replacement. The ' +
          'reservation itself is not affected.',
        label: 'Reason for rejecting this document',
        confirmLabel: 'Reject document',
        destructive: true,
        required: true,
      });
      if (reason === null || reason.trim() === '') return;
      note = reason;
    }

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
      {dialog}
      <header className="review-head">
        <div>
          <h3>
            {DOC_TYPE_LABELS[document.docType]}
            {document.idType && (
              <span className="cell-sub"> — {ID_TYPE_LABELS[document.idType]}</span>
            )}
          </h3>
          <p className="cell-sub">
            {(document.sizeBytes / 1024).toFixed(0)} KB &middot;{' '}
            {document.mimeType}
            {document.backSizeBytes != null && (
              <> &middot; back {(document.backSizeBytes / 1024).toFixed(0)} KB</>
            )}
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
            {document.backFileUrl ? 'Open front' : 'Open file'}
          </a>
          {/* Reviewing only the front would leave half the card unseen — the
              restrictions on a licence and the address on a PhilSys card are
              both on the back. */}
          {document.backFileUrl && (
            <a
              href={document.backFileUrl}
              target="_blank"
              rel="noreferrer"
              className="btn"
            >
              Open back
            </a>
          )}
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
