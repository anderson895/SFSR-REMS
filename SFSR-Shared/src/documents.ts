/**
 * Documentary requirement records.
 *
 * A document row is created the moment the file lands in Cloudinary, before OCR
 * has run. That ordering is deliberate: if OCR fails or the browser is closed
 * mid-scan, the uploaded file is still recorded and staff can re-scan it, rather
 * than the upload vanishing.
 */

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { type DocType, DocumentStatus, type IdType } from './constants';
import { COLLECTIONS, db } from './firebase';
import type { OcrResult, PaymentDetails, ValidationResult } from './types';

export interface CreateDocumentInput {
  reservationId: string;
  buyerUid: string | null;
  docType: DocType;
  /** The specific card, when docType is Valid ID. Null otherwise. */
  idType?: IdType | null;
  fileUrl: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
  /** Reverse of the card, when the document type has one. */
  backFileUrl?: string | null;
  backPublicId?: string | null;
  backMimeType?: string | null;
  backSizeBytes?: number | null;
  uploadedBy: string;
  /** Present only on a Proof of Reservation Payment. */
  payment?: PaymentDetails | null;
}

export async function createDocumentRecord(
  input: CreateDocumentInput,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), {
    ...input,
    // Explicit null rather than undefined: Firestore drops undefined fields,
    // and a missing key reads as "not recorded" instead of "not applicable".
    idType: input.idType ?? null,
    backFileUrl: input.backFileUrl ?? null,
    backPublicId: input.backPublicId ?? null,
    backMimeType: input.backMimeType ?? null,
    backSizeBytes: input.backSizeBytes ?? null,
    // What the payer declared. Kept apart from anything OCR later reads off the
    // receipt, so Billing can compare the two rather than trust one.
    payment: input.payment ?? null,
    ocr: null,
    backOcr: null,
    validation: null,
    status: DocumentStatus.PENDING,
    uploadedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Attaches OCR output and validation results once scanning finishes. */
export async function saveDocumentAnalysis(
  documentId: string,
  ocr: OcrResult,
  validation: ValidationResult,
  backOcr: OcrResult | null = null,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId), {
    ocr,
    backOcr,
    validation,
  });
}

/** Staff decision on a single document. */
export async function reviewDocument(
  documentId: string,
  status: Exclude<DocumentStatus, 'pending'>,
  reviewerUid: string,
  note = '',
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId), {
    status,
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    reviewNote: note,
  });
}
