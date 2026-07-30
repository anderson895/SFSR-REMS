import type { Timestamp } from 'firebase/firestore';
import type { ConsentRecord } from './legal';
import type {
  AccountType,
  DocType,
  DocumentStatus,
  ReservationSource,
  IdType,
  PaymentChannel,
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
  /**
   * Privacy and terms consent captured at registration.
   *
   * Required by the Data Privacy Act of 2012: the company has to be able to
   * show not only that consent was given, but which wording was consented to
   * and when.
   */
  consent?: ConsentRecord;
  active: boolean;
  createdAt: Timestamp;
}

/** Convenience for OCR name matching and display. */
export const fullNameOf = (
  p: Pick<UserProfile, 'firstName' | 'middleName' | 'lastName'>,
): string => [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');

/**
 * A development. Collection: `projects/{projectId}`.
 *
 * Everything true of the whole development rather than of any one unit lives
 * here, stored once instead of once per unit.
 */
export interface Project {
  id: string;
  name: string;
  /** Where the project stands, e.g. "Legaspi Village, Makati City". */
  location: string;
  building: string;
  amenities: string[];
  images: string[];
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * One unit type within a project. Collection: `unitTypes/{typeId}`.
 *
 * A Studio's floor area, floor plan, and photographs are identical for all 120
 * Studios, so they belong here rather than being copied onto each one. This is
 * also what lets the catalogue render from a handful of documents instead of
 * reading the entire inventory to summarise it.
 */
export interface UnitType {
  id: string;
  projectId: string;
  /** Denormalised for labelling without a second lookup. */
  projectName: string;
  /** e.g. "Studio", "1BR", "2BR", "3BR" */
  type: string;
  floorAreaSqm: number;
  floorPlanUrl?: string;
  images: string[];
  description?: string;
  promo?: string;
  /**
   * Facts about the whole set of units of this type.
   *
   * Stored here rather than derived from whatever units a page happens to have
   * loaded. That distinction is the whole reason the catalogue broke once: a
   * capped listener plus counts taken from the loaded documents reported 192 of
   * 320 units and hid two unit types entirely. A page may show a subset; it may
   * never describe the set from that subset.
   */
  startingPrice: number;
  /** Price of the highest floor — the top of the advertised range. */
  endingPrice: number;
  /** How many units of this type exist, regardless of status. */
  totalCount: number;
  lowestFloor: number;
  highestFloor: number;
  /** Catalogue ordering; lower comes first. */
  sortOrder: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * A condominium unit in the inventory. Collection: `units/{unitId}`.
 *
 * Reduced to what genuinely varies per unit. Amenities, images, floor plans,
 * and descriptions moved to the project or the type: eight identical amenities
 * repeated across 320 units cost 70 KB to say the same thing 320 times.
 */
export interface Unit {
  id: string;
  /** Reference to `projects/{projectId}`. */
  projectId: string;
  /** Reference to `unitTypes/{typeId}`. */
  typeId: string;
  unitNo: string;
  floor: number;
  price: number;
  status: UnitStatus;
  /** Reservation currently holding this unit, if any. */
  heldBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  /**
   * Two denormalised copies are kept deliberately, so a unit can be listed,
   * filtered, and labelled without joining two more documents first.
   */
  projectName: string;
  /** e.g. "Studio", "1BR", "2BR", "3BR" */
  type: string;
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

  /**
   * The buyer's declaration and acceptance of the reservation terms.
   *
   * Stored on the reservation rather than the account because the terms are
   * agreed to per application: a buyer who reserves twice accepts twice, and
   * the wording may have changed between them.
   *
   * Optional so that walk-in records filed by staff, and any reservation made
   * before this was captured, still load.
   */
  declaration?: ConsentRecord;
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
  /** The buyer who filed it. Never null — requests require an account. */
  requestedByUid: string;
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
  /**
   * Stage 1 — does the file look like the document type the user chose?
   *
   * **Null means the check did not apply**, not that it passed. The only
   * category that produces null is Other Supporting Document, which has no
   * keyword signature to check against. Read this with `=== false`, never with
   * `!typeMatch`: the latter treats "not checked" as "failed".
   */
  typeMatch: boolean | null;
  typeScore: number;
  /**
   * A better-scoring category than the one chosen, when there is one.
   *
   * On an Other Supporting Document this is the *only* type signal available,
   * and it is reported precisely so the catch-all cannot be used to slip a
   * recognisable document past Stage 1.
   */
  detectedType: DocType | null;
  /**
   * Stage 1b — for a Valid ID, is it the *specific* card the buyer selected?
   *
   * Null on documents where no ID subtype was claimed, which is every category
   * other than Valid ID.
   */
  idTypeMatch?: boolean | null;
  idTypeScore?: number;
  detectedIdType?: IdType | null;
  /**
   * Whether the two uploaded sides are genuinely different images.
   *
   * False when the buyer photographed the front twice, which is the common
   * mistake and otherwise passes silently — the front is valid, so every other
   * check succeeds. Null when no back was required.
   */
  backSideDistinct?: boolean | null;
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
  /** Which government ID this is. Only set when docType is `valid_id`. */
  idType?: IdType | null;
  /** Front of the card. The side every check reads. */
  fileUrl: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
  /**
   * Reverse of the card, for IDs that carry data there — restrictions on a
   * licence, address on a PhilSys card.
   *
   * Held on the same record rather than a second document, because the
   * requirements checklist counts one approval per document type: two records
   * would let staff approve the front and mark the ID complete with the back
   * unreviewed.
   */
  backFileUrl?: string | null;
  backPublicId?: string | null;
  backMimeType?: string | null;
  backSizeBytes?: number | null;
  uploadedBy: string;
  uploadedAt: Timestamp;
  /** OCR of the front. */
  ocr: OcrResult | null;
  /** OCR of the back, when one was supplied. */
  backOcr?: OcrResult | null;
  validation: ValidationResult | null;
  status: DocumentStatus;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewNote?: string;

  /**
   * Present only on a Proof of Reservation Payment.
   *
   * A receipt image alone cannot be reconciled: Billing needs the channel it
   * came through, the reference the channel issued, the amount, and the date
   * the payer says it was made. OCR may later confirm these against the image,
   * but what the buyer declared is a separate fact worth keeping.
   */
  payment?: PaymentDetails;
}

/** What the payer declares alongside a receipt. */
export interface PaymentDetails {
  /** ISO date, as declared by the payer. */
  paidOn: string;
  referenceNo: string;
  channel: PaymentChannel;
  amount: number;
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
