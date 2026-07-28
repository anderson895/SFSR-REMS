import { type ChangeEvent, type FormEvent, useState } from 'react';
import {
  ACCEPTED_MIME_TYPES,
  DOC_TYPE_LABELS,
  DocType,
  MAX_UPLOAD_BYTES,
} from '../constants';
import { writeAuditLog } from '../audit';
import { uploadToCloudinary, validateFile } from '../cloudinary';
import { createDocumentRecord } from '../documents';
import { useDocumentAnalysis } from './useDocumentAnalysis';

export interface DocumentUploaderProps {
  reservationId: string;
  buyerUid: string | null;
  /** UID of whoever is doing the uploading — the buyer, or staff for walk-ins. */
  uploadedBy: string;
  /** Display name of the uploader, recorded in the audit trail. */
  uploadedByName?: string;
  /**
   * The buyer's registered name, used as the comparison target for Stage 2.
   * When omitted, the file is uploaded but not scanned.
   */
  registeredName?: string;
  /** Called with the new document id once the record exists. */
  onUploaded?: (documentId: string, file: File, docType: DocType) => void;
}

/**
 * Document type is chosen BEFORE the file is picked.
 *
 * This is not cosmetic ordering: Stage 1 of validation compares what the file
 * actually looks like against what the user said it was, so the declared type
 * has to exist before the file can be judged.
 *
 * Shared by both applications so the buyer's upload and the staff's scan of a
 * walk-in's paperwork behave identically and produce identical records.
 */
export function DocumentUploader({
  reservationId,
  buyerUid,
  uploadedBy,
  uploadedByName,
  registeredName,
  onUploaded,
}: DocumentUploaderProps) {
  const [docType, setDocType] = useState<DocType | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const analysis = useDocumentAnalysis();

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setError('');

    if (chosen) {
      const problem = validateFile(chosen);
      if (problem) {
        setError(problem);
        setFile(null);
        event.target.value = '';
        return;
      }
    }
    setFile(chosen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!docType || !file) {
      setError('Choose a document type and a file.');
      return;
    }

    setError('');
    setBusy(true);
    setProgress(0);

    try {
      const uploaded = await uploadToCloudinary(
        file,
        `sfsr/reservations/${reservationId}`,
        setProgress,
      );

      const documentId = await createDocumentRecord({
        reservationId,
        buyerUid,
        docType,
        fileUrl: uploaded.url,
        publicId: uploaded.publicId,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        uploadedBy,
      });

      await writeAuditLog({
        actorUid: uploadedBy,
        actorName: uploadedByName ?? '',
        action: 'document.uploaded',
        targetType: 'document',
        targetId: documentId,
        meta: { reservationId, docType, sizeBytes: uploaded.sizeBytes },
      });

      onUploaded?.(documentId, file, docType);

      const form = event.target as HTMLFormElement;
      setFile(null);
      setDocType('');
      setProgress(0);
      form.reset();
      // The upload itself is finished; releasing the button here keeps the form
      // usable while the slower OCR pass runs on the file already in hand.
      setBusy(false);

      // OCR starts automatically once the file is saved, per the study's
      // document validation flow. It reads the File still in memory rather than
      // re-downloading what was just sent to Cloudinary.
      if (registeredName) {
        await analysis.analyze(documentId, file, docType, registeredName);
      }
    } catch (err) {
      setError((err as Error).message ?? 'Upload failed.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="uploader">
      {error && <p className="field-error">{error}</p>}

      <div className="uploader-row">
        <label>
          Document type
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocType)}
            required
            disabled={busy}
          >
            <option value="">Select a document type…</option>
            {Object.values(DocType).map((type) => (
              <option key={type} value={type}>
                {DOC_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label>
          File
          <input
            type="file"
            accept={ACCEPTED_MIME_TYPES.join(',')}
            onChange={handleFileChange}
            required
            disabled={busy}
          />
        </label>
      </div>

      <p className="uploader-hint">
        PDF, JPG, JPEG, or PNG. Maximum{' '}
        {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. Scans and clear phone
        photos are both accepted — sharper images give better OCR results.
      </p>

      {busy && (
        <div className="progress">
          <div
            className="progress-bar"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
          <span>{Math.round(progress * 100)}%</span>
        </div>
      )}

      {analysis.running && (
        <div className="ocr-status">
          <div className="progress">
            <div
              className="progress-bar is-ocr"
              style={{ width: `${Math.round(analysis.progress * 100)}%` }}
            />
            <span>{Math.round(analysis.progress * 100)}%</span>
          </div>
          <p>
            Reading document with OCR — {analysis.phase}. The first scan takes
            longer while the recognition model loads.
          </p>
        </div>
      )}

      {analysis.error && <p className="field-error">{analysis.error}</p>}

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Uploading…' : 'Upload document'}
      </button>
    </form>
  );
}
