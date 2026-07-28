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
import { type DocType, DocumentStatus } from './constants';
import { COLLECTIONS, db } from './firebase';
import type { OcrResult, ValidationResult } from './types';

export interface CreateDocumentInput {
  reservationId: string;
  buyerUid: string | null;
  docType: DocType;
  fileUrl: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
}

export async function createDocumentRecord(
  input: CreateDocumentInput,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), {
    ...input,
    ocr: null,
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
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId), {
    ocr,
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
