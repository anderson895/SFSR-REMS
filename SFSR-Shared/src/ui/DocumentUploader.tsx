import { type ChangeEvent, type FormEvent, useState } from 'react';
import {
  ACCEPTED_ID_TYPES,
  ACCEPTED_MIME_TYPES,
  DOC_TYPE_LABELS,
  DocType,
  ID_TYPE_LABELS,
  type IdType,
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
   * When omitted, files are uploaded but not scanned.
   */
  registeredName?: string;
  /** Called with the new document id once the record exists. */
  onUploaded?: (documentId: string, file: File, docType: DocType) => void;
}

type ItemStatus = 'queued' | 'uploading' | 'scanning' | 'done' | 'failed';

interface QueuedDocument {
  key: string;
  docType: DocType;
  idType: IdType | null;
  file: File;
  backFile: File | null;
  status: ItemStatus;
  /** 0..1 while uploading. */
  progress: number;
  error: string;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: 'Waiting',
  uploading: 'Uploading',
  scanning: 'Reading with OCR',
  done: 'Uploaded',
  failed: 'Failed',
};

/**
 * Builds a queue of documents, then uploads and scans them one after another.
 *
 * The document type is chosen per file and before the file, which is not
 * cosmetic ordering: Stage 1 of validation compares what the file actually
 * looks like against what the uploader declared it to be, so the declaration
 * has to exist first. That is also why a plain "drop five files here" control
 * would not work — five files with no declared types cannot be checked.
 *
 * Queuing matters most for walk-ins, where staff hold a stack of scanned
 * paperwork. Uploading one at a time meant waiting through a full OCR pass,
 * ten to thirty seconds, before the next document could even be selected.
 *
 * Processing is sequential rather than parallel because OCR is CPU-bound on a
 * single Tesseract worker; running four at once would not finish sooner and
 * would make the page unresponsive while it tried.
 *
 * Shared by both applications so a buyer's upload and staff's scan of a
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
  const [queue, setQueue] = useState<QueuedDocument[]>([]);
  const [running, setRunning] = useState(false);

  const [docType, setDocType] = useState<DocType | ''>('');
  const [idType, setIdType] = useState<IdType | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const analysis = useDocumentAnalysis();

  const pending = queue.filter((q) => q.status === 'queued').length;

  function pickFile(
    event: ChangeEvent<HTMLInputElement>,
    set: (file: File | null) => void,
  ) {
    const chosen = event.target.files?.[0] ?? null;
    setError('');

    if (chosen) {
      // Rejected at selection time rather than at upload, so the problem is
      // reported while the file picker is still fresh in mind.
      const problem = validateFile(chosen);
      if (problem) {
        setError(problem);
        set(null);
        event.target.value = '';
        return;
      }
    }
    set(chosen);
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();

    if (!docType || !file) {
      setError('Choose a document type and a file.');
      return;
    }
    // Without the specific card, Stage 1b cannot run and the check degrades to
    // "is this any ID at all" — which is what Stage 1 already did.
    if (docType === DocType.VALID_ID && !idType) {
      setError('Choose which government ID this is.');
      return;
    }
    if (docType === DocType.VALID_ID && !backFile) {
      setError('Upload the back of the ID as well.');
      return;
    }

    setQueue((current) => [
      ...current,
      {
        key: `${Date.now()}-${current.length}`,
        docType,
        idType: docType === DocType.VALID_ID ? (idType as IdType) : null,
        file,
        backFile,
        status: 'queued',
        progress: 0,
        error: '',
      },
    ]);

    setError('');
    setDocType('');
    setIdType('');
    setFile(null);
    setBackFile(null);
    (event.target as HTMLFormElement).reset();
  }

  const update = (key: string, patch: Partial<QueuedDocument>) =>
    setQueue((current) =>
      current.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    );

  async function processOne(item: QueuedDocument) {
    update(item.key, { status: 'uploading', progress: 0, error: '' });

    const folder = `sfsr/reservations/${reservationId}`;
    const uploaded = await uploadToCloudinary(item.file, folder, (p) =>
      update(item.key, { progress: p }),
    );
    const uploadedBack = item.backFile
      ? await uploadToCloudinary(item.backFile, folder)
      : null;

    const documentId = await createDocumentRecord({
      reservationId,
      buyerUid,
      docType: item.docType,
      idType: item.idType,
      fileUrl: uploaded.url,
      publicId: uploaded.publicId,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      backFileUrl: uploadedBack?.url ?? null,
      backPublicId: uploadedBack?.publicId ?? null,
      backMimeType: uploadedBack?.mimeType ?? null,
      backSizeBytes: uploadedBack?.sizeBytes ?? null,
      uploadedBy,
    });

    await writeAuditLog({
      actorUid: uploadedBy,
      actorName: uploadedByName ?? '',
      action: 'document.uploaded',
      targetType: 'document',
      targetId: documentId,
      meta: {
        reservationId,
        docType: item.docType,
        sizeBytes: uploaded.sizeBytes,
      },
    });

    onUploaded?.(documentId, item.file, item.docType);

    // OCR starts automatically once the file is stored, per the study's
    // document validation flow. It reads the File still in memory rather than
    // re-downloading what was just sent to Cloudinary.
    if (registeredName) {
      update(item.key, { status: 'scanning' });
      await analysis.analyze(documentId, {
        file: item.file,
        backFile: item.backFile,
        docType: item.docType,
        idType: item.idType,
        registeredName,
      });
    }

    update(item.key, { status: 'done', progress: 1 });
  }

  async function handleUploadAll() {
    setRunning(true);
    setError('');

    // A snapshot is taken because each item mutates queue state as it runs, and
    // iterating the live array would re-read entries that have already moved on.
    const batch = queue.filter((q) => q.status === 'queued');

    for (const item of batch) {
      try {
        await processOne(item);
      } catch (err) {
        // One bad file must not abandon the rest of the stack.
        update(item.key, {
          status: 'failed',
          error: (err as Error).message ?? 'Upload failed.',
        });
      }
    }

    setRunning(false);
  }

  return (
    <div className="uploader">
      <form onSubmit={handleAdd}>
        {error && <p className="field-error">{error}</p>}

        <div className="uploader-row">
          <label>
            Document type
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              required
              disabled={running}
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
            {docType === DocType.VALID_ID ? 'Front of the ID' : 'File'}
            <input
              type="file"
              accept={ACCEPTED_MIME_TYPES.join(',')}
              onChange={(e) => pickFile(e, setFile)}
              required
              disabled={running}
            />
          </label>

          {docType === DocType.VALID_ID && (
            <label>
              Back of the ID
              <input
                type="file"
                accept={ACCEPTED_MIME_TYPES.join(',')}
                onChange={(e) => pickFile(e, setBackFile)}
                required
                disabled={running}
              />
            </label>
          )}
        </div>

        {/* Only the accepted primary IDs are offered. The system recognises
            PhilHealth, TIN and the rest so it can name them when refusing, but
            offering them would imply they are acceptable here. */}
        {docType === DocType.VALID_ID && (
          <label>
            Which government ID?
            <select
              value={idType}
              onChange={(e) => setIdType(e.target.value as IdType)}
              required
              disabled={running}
            >
              <option value="">Select the ID you are uploading…</option>
              {ACCEPTED_ID_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ID_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="uploader-hint">
          PDF, JPG, JPEG, or PNG. Maximum{' '}
          {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. Scans and clear phone
          photos are both accepted — sharper images give better OCR results.
        </p>

        <button type="submit" className="btn" disabled={running}>
          Add to list
        </button>
      </form>

      {queue.length > 0 && (
        <ul className="upload-queue">
          {queue.map((item) => (
            <li key={item.key} className={`upload-queue-item is-${item.status}`}>
              <div className="upload-queue-head">
                <strong>{DOC_TYPE_LABELS[item.docType]}</strong>
                <span className="upload-queue-file">
                  {item.file.name}
                  {item.backFile && ` + ${item.backFile.name}`}
                </span>
                <span className="upload-queue-status">
                  {item.status === 'scanning' && analysis.running
                    ? `Reading with OCR — ${analysis.phase}`
                    : STATUS_LABEL[item.status]}
                </span>

                {item.status === 'queued' && !running && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() =>
                      setQueue((c) => c.filter((q) => q.key !== item.key))
                    }
                  >
                    Remove
                  </button>
                )}
              </div>

              {(item.status === 'uploading' || item.status === 'scanning') && (
                <div className="progress">
                  <div
                    className={`progress-bar${item.status === 'scanning' ? ' is-ocr' : ''}`}
                    style={{
                      width: `${Math.round(
                        (item.status === 'scanning'
                          ? analysis.progress
                          : item.progress) * 100,
                      )}%`,
                    }}
                  />
                </div>
              )}

              {item.error && <p className="field-error">{item.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {pending > 0 && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={running}
          onClick={() => void handleUploadAll()}
        >
          {running
            ? 'Uploading…'
            : `Upload ${pending} document${pending === 1 ? '' : 's'}`}
        </button>
      )}

      {running && (
        <p className="uploader-hint">
          Uploading and scanning one at a time. The first scan takes longer while
          the recognition model loads. You can leave this page open.
        </p>
      )}
    </div>
  );
}
