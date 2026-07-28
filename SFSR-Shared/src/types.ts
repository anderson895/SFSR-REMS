import type { Timestamp } from 'firebase/firestore';
import type {
  AccountType,
  DocType,
  DocumentStatus,
  ReservationSource,
  ReservationStatus,
  Role,
  TrippingStatus,
  UnitStatus,
  Verdict,
} from './constants';

/** A registered person — buyer or employee. Collection: `users/{uid}`. */
export interface UserProfile {
  uid: string;
  role: Role;
  accountType: AccountType;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  mobile?: string;
  address?: string;
  birthDate?: string;
  /** Employees only — the department shown in the internal app. */
  department?: string;
  active: boolean;
  createdAt: Timestamp;
}

/** Convenience for OCR name matching and display. */
export const fullNameOf = (
  p: Pick<UserProfile, 'firstName' | 'middleName' | 'lastName'>,
): string => [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');

/** A condominium unit in the inventory. Collection: `units/{unitId}`. */
export interface Unit {
  id: string;
  projectName: string;
  /** Where the project stands, e.g. "Legaspi Village, Makati City". */
  location?: string;
  building: string;
  unitNo: string;
  floor: number;
  /** e.g. "Studio", "1BR", "2BR", "3BR" */
  type: string;
  floorAreaSqm: number;
  price: number;
  status: UnitStatus;
  amenities: string[];
  images: string[];
  floorPlanUrl?: string;
  description?: string;
  promo?: string;
  /** Reservation currently holding this unit, if any. */
  heldBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Buyer details captured at reservation time. */
export interface BuyerSnapshot {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  mobile?: string;
  address?: string;
  idNumber?: string;
}

/** A reservation request. Collection: `reservations/{reservationId}`. */
export interface Reservation {
  id: string;
  unitId: string;
  /** Denormalised label, e.g. "Tower A - Unit 1203", for list views. */
  unitLabel: string;
  /** Null for walk-in buyers who have no portal account. */
  buyerUid: string | null;
  buyer: BuyerSnapshot;
  source: ReservationSource;
  status: ReservationStatus;
  reservationDate: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  /**
   * Who withdrew the reservation. Kept separate from `reviewedBy` because a
   * cancellation is not a review — this is often the buyer themselves, and
   * conflating the two would misreport who assessed the application.
   */
  cancelledBy?: string;
  cancelledAt?: Timestamp;
  remarks?: string;
}

/**
 * A request to visit a project on site. Collection: `trippingRequests/{id}`.
 *
 * Deliberately not tied to a unit or a user account. Tripping is what happens
 * *before* someone commits — most people asking for one have not registered,
 * and many are still choosing between developments.
 */
export interface TrippingRequest {
  id: string;
  projectName: string;
  fullName: string;
  email: string;
  mobile: string;
  /** ISO date, e.g. "2026-08-14". Stored as a string so the buyer's chosen
   *  calendar day cannot be shifted by a timezone conversion. */
  preferredDate: string;
  /** One of TRIPPING_SLOTS. */
  preferredSlot: string;
  partySize: number;
  message?: string;
  status: TrippingStatus;
  /** Set when the visitor happened to be signed in; null for a cold lead. */
  requestedByUid: string | null;
  createdAt: Timestamp;
  handledBy?: string;
  handledAt?: Timestamp;
  staffNote?: string;
}

/** What OCR pulled out of a document image. */
export interface OcrResult {
  rawText: string;
  extracted: {
    fullName?: string;
    idNumber?: string;
    date?: string;
    address?: string;
  };
  engine: string;
  /** Tesseract's mean confidence, 0..100. */
  meanConfidence: number;
  processedAt: string;
}

/** Outcome of the two-stage validation described in the manuscript. */
export interface ValidationResult {
  /** Stage 1 — does the file look like the document type the user chose? */
  typeMatch: boolean;
  typeScore: number;
  detectedType: DocType | null;
  /** Stage 2 — does the name on the document match the registered buyer? */
  nameDistance: number;
  nameSimilarity: number;
  comparedAgainst: string;
  matchedText: string;
  verdict: Verdict;
  /** Human-readable explanation shown to both buyer and reviewing staff. */
  message: string;
}

/** An uploaded documentary requirement. Collection: `documents/{documentId}`. */
export interface DocumentRecord {
  id: string;
  reservationId: string;
  buyerUid: string | null;
  docType: DocType;
  fileUrl: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: Timestamp;
  ocr: OcrResult | null;
  validation: ValidationResult | null;
  status: DocumentStatus;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewNote?: string;
}

/** Immutable activity record. Collection: `auditLogs/{id}`. */
export interface AuditLog {
  id: string;
  actorUid: string;
  actorName: string;
  action: string;
  targetType: 'unit' | 'reservation' | 'document' | 'user' | 'tripping';
  targetId: string;
  at: Timestamp;
  meta?: Record<string, unknown>;
}
