import {
  ACCEPTED_ID_TYPES,
  ACCEPTED_MIME_TYPES,
  BUYER_DECLARATIONS,
  DocType,
  RESERVATION_TERMS,
  buildConsent,
  ID_TYPE_LABELS,
  type IdType,
  MAX_UPLOAD_BYTES,
  ReservationSource,
  UnitStatus,
  UnitUnavailableError,
  Verdict,
  createDocumentRecord,
  createReservation,
  fullNameOf,
  saveDocumentAnalysis,
  uploadToCloudinary,
  useDocumentAnalysis,
  validateFile,
  writeAuditLog,
} from '@sfsr/shared';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
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
 *
 * The valid ID is collected and checked *here*, before the unit is held. Order
 * matters: OCR runs in the browser, so the ID can be read and matched against
 * the buyer's name without uploading anything. Only once it passes does the
 * unit go On Hold and the file leave the device. A buyer holding the wrong
 * document therefore never takes a unit off the market, and a failed attempt
 * leaves no orphaned file in Cloudinary.
 */
export default function ReservePage() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { unit, unitType, loading, error: unitError } = useUnit(unitId);

  const [buyer, setBuyer] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    mobile: '',
    address: '',
    idNumber: '',
  });
  const [idType, setIdType] = useState<IdType | ''>('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** What the automated check said, shown before the reservation is created. */
  const [idVerdict, setIdVerdict] = useState('');
  /**
   * Set the moment this page's own reservation succeeds.
   *
   * `useUnit` is a live subscription, so the unit flips to `on_hold` the
   * instant the reservation commits — while the ID is still uploading. Without
   * this the "no longer available" guard below fires on the buyer's own hold
   * and tells them someone else got there first, which is both wrong and
   * alarming.
   */
  const [ownHold, setOwnHold] = useState('');
  /** Ticked items from the buyer's declaration; all are required to submit. */
  const [declared, setDeclared] = useState<string[]>([]);
  const analysis = useDocumentAnalysis();

  const allDeclared = BUYER_DECLARATIONS.every((d) => declared.includes(d.id));

  const toggleDeclaration = (id: string) =>
    setDeclared((current) =>
      current.includes(id)
        ? current.filter((d) => d !== id)
        : [...current, id],
    );

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
        <h2>{unitError ? 'We could not load this unit' : 'Unit not found'}</h2>
        {unitError && (
          <p className="field-error">
            {unitError}. Nothing has been reserved — please try again.
          </p>
        )}
        <p>
          <Link to="/units">Back to available units</Link>
        </p>
      </div>
    );
  }

  // `ownHold` exempts the buyer from their own hold — see the state above.
  if (!ownHold && unit.status !== UnitStatus.AVAILABLE) {
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

  function pickIdFile(
    event: ChangeEvent<HTMLInputElement>,
    set: (file: File | null) => void,
  ) {
    const chosen = event.target.files?.[0] ?? null;
    setError('');
    setIdVerdict('');

    if (chosen) {
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !unit) return;

    if (!idType || !idFile || !idBackFile) {
      setError(
        'Select your ID type and upload photos of both the front and the back.',
      );
      return;
    }

    setError('');
    setIdVerdict('');
    setBusy(true);

    try {
      // --- 1. Read and check the ID, before anything is written -----------
      const registeredName = fullNameOf(buyer);
      const result = await analysis.inspect({
        file: idFile,
        backFile: idBackFile,
        docType: DocType.VALID_ID,
        idType,
        registeredName,
      });

      if (!result) {
        // `analysis.error` is already displayed; nothing was committed.
        setBusy(false);
        return;
      }

      const { ocr, backOcr, validation } = result;

      // Stage 1 or 1b failed — wrong document, or the wrong ID. Refuse before
      // the unit is touched.
      if (!validation.typeMatch || validation.idTypeMatch === false) {
        setError(validation.message);
        setBusy(false);
        return;
      }

      // Photographing the front twice is the common mistake, and it otherwise
      // passes in silence: the front is a valid ID, so every other check
      // succeeds and nobody notices the back was never supplied.
      if (validation.backSideDistinct === false) {
        setError(
          'Both images look like the same side of your ID. Upload the front ' +
            'and the back as separate photos.',
        );
        setBusy(false);
        return;
      }

      // Stage 2 is a name comparison, and OCR misreads names often enough that
      // a hard block here would turn away legitimate buyers. A mismatch is
      // surfaced and left for staff, exactly as the study requires — the
      // automated result is a recommendation, never the decision.
      if (validation.verdict !== Verdict.MATCH) {
        setIdVerdict(validation.message);
      }

      // --- 2. Now take the unit ------------------------------------------
      const reservationId = await createReservation({
        unitId: unit.id,
        buyer,
        buyerUid: user.uid,
        source: ReservationSource.ONLINE,
        createdBy: user.uid,
        // Recorded per application, with the wording version, because the terms
        // are agreed to for this reservation and may change before the next.
        declaration: buildConsent(declared),
      });

      // Claim the hold before anything else can re-render: the live unit
      // subscription has already fired by now.
      setOwnHold(reservationId);

      await writeAuditLog({
        actorUid: user.uid,
        actorName: registeredName,
        action: 'reservation.created',
        targetType: 'reservation',
        targetId: reservationId,
        meta: { unitId: unit.id, unitNo: unit.unitNo, source: 'online' },
      });

      // --- 3. Only now does the file leave the device ---------------------
      //
      // Past this point the reservation exists and the unit is held, so a
      // failure here must not look like a failed reservation. The buyer is
      // sent to their reservation either way, where the uploader can retry the
      // ID — stranding them on this form would leave a real hold they cannot
      // see.
      try {
        const folder = `sfsr/reservations/${reservationId}`;
        const [front, back] = await Promise.all([
          uploadToCloudinary(idFile, folder),
          uploadToCloudinary(idBackFile, folder),
        ]);

        const documentId = await createDocumentRecord({
          reservationId,
          buyerUid: user.uid,
          docType: DocType.VALID_ID,
          idType,
          fileUrl: front.url,
          publicId: front.publicId,
          mimeType: front.mimeType,
          sizeBytes: front.sizeBytes,
          backFileUrl: back.url,
          backPublicId: back.publicId,
          backMimeType: back.mimeType,
          backSizeBytes: back.sizeBytes,
          uploadedBy: user.uid,
        });

        // The scan already ran in step 1; persist it rather than repeating a
        // ten-second OCR pass on files that have not changed.
        await saveDocumentAnalysis(documentId, ocr, validation, backOcr);

        await writeAuditLog({
          actorUid: user.uid,
          actorName: registeredName,
          action: 'document.uploaded',
          targetType: 'document',
          targetId: documentId,
          meta: { reservationId, docType: DocType.VALID_ID, idType },
        });
      } catch (uploadError) {
        // Carried to the reservation page rather than logged and forgotten:
        // the hold is real and the buyer has to know their ID did not attach,
        // or they will wait for a review that cannot start.
        navigate(`/reservations/${reservationId}`, {
          replace: true,
          state: {
            uploadFailed:
              (uploadError as Error).message ??
              'Your ID could not be uploaded.',
          },
        });
        return;
      }

      navigate(`/reservations/${reservationId}`, { replace: true });
    } catch (err) {
      // The transaction lost a race with another buyer, or the unit changed
      // status between page load and submission.
      setError(
        err instanceof UnitUnavailableError
          ? err.message
          : ((err as Error).message ?? 'Could not complete the reservation.'),
      );
      setBusy(false);
    }
  }

  return (
    <div className="form-card form-card-wide">
      <h1>Reserve Unit {unit.unitNo}</h1>
      <p className="form-sub">
        {unit.projectName} &middot; {unit.type}
        {unitType && <> &middot; {unitType.floorAreaSqm} sqm</>} &middot;{' '}
        {formatPeso(unit.price)}
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

        <h2 className="mb-1 mt-8 text-lg font-semibold">Valid ID</h2>
        <p className="form-sub">
          Required to reserve. Your ID is checked before the unit is held — if
          it does not match what you selected, nothing is reserved and you can
          try again.
        </p>

        <div className="form-row">
          <label>
            ID type
            <select
              value={idType}
              onChange={(e) => {
                setIdType(e.target.value as IdType);
                setIdVerdict('');
              }}
              required
              disabled={busy}
            >
              <option value="">Select your ID…</option>
              {ACCEPTED_ID_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ID_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Front of the ID
            <input
              type="file"
              accept={ACCEPTED_MIME_TYPES.join(',')}
              onChange={(e) => pickIdFile(e, setIdFile)}
              required
              disabled={busy}
            />
          </label>

          <label>
            Back of the ID
            <input
              type="file"
              accept={ACCEPTED_MIME_TYPES.join(',')}
              onChange={(e) => pickIdFile(e, setIdBackFile)}
              required
              disabled={busy}
            />
          </label>
        </div>

        <p className="hint">
          PDF, JPG, JPEG or PNG, up to{' '}
          {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB each. The front is
          what identifies the card, so make sure its header and issuing office
          are readable. The back carries details staff need on review —
          restrictions on a licence, address on a PhilSys card.
        </p>

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
              Checking your ID — {analysis.phase}. This runs on your device; the
              file is only uploaded once it passes. The first check takes longer
              while the recognition model loads.
            </p>
          </div>
        )}

        {analysis.error && <p className="field-error">{analysis.error}</p>}
        {idVerdict && <p className="field-note">{idVerdict}</p>}

        <section className="terms">
          <h2>Reservation Terms and Conditions</h2>
          {/* Scrollable rather than collapsed: the terms have to be present on
              the page that submits them, not one click away behind a link the
              buyer can plausibly say they never opened. */}
          <ol className="terms-list">
            {RESERVATION_TERMS.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ol>
        </section>

        <fieldset className="consent">
          <legend>Buyer's Declaration</legend>
          {BUYER_DECLARATIONS.map((item) => (
            <label key={item.id} className="check-line">
              <input
                type="checkbox"
                checked={declared.includes(item.id)}
                onChange={() => toggleDeclaration(item.id)}
              />
              {item.text}
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !allDeclared}
        >
          {busy ? 'Checking ID and reserving…' : 'Submit reservation'}
        </button>

        {!allDeclared && (
          <p className="hint">
            Every item in the declaration must be ticked before the reservation
            can be submitted.
          </p>
        )}
      </form>
    </div>
  );
}
