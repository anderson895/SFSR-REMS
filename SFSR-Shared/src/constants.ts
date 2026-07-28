/**
 * Shared enumerations and business rules for SFSR-REMS.
 *
 * Kept as `const` objects rather than TS `enum`s so the values survive
 * unchanged into Firestore documents and can be compared directly in
 * security rules.
 */

/** Lifecycle of a condominium unit in the inventory. */
export const UnitStatus = {
  AVAILABLE: 'available',
  ON_HOLD: 'on_hold',
  RESERVED: 'reserved',
  SOLD: 'sold',
} as const;
export type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

/** Lifecycle of a reservation request. */
export const ReservationStatus = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;
export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];

/** Where a reservation originated. */
export const ReservationSource = {
  ONLINE: 'online',
  WALK_IN: 'walkin',
} as const;
export type ReservationSource =
  (typeof ReservationSource)[keyof typeof ReservationSource];

/** Review state of an uploaded documentary requirement. */
export const DocumentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
export type DocumentStatus =
  (typeof DocumentStatus)[keyof typeof DocumentStatus];

/**
 * User roles. A buyer may only sign in to the Web Portal; the other three may
 * only sign in to the Internal Management System.
 */
export const Role = {
  BUYER: 'buyer',
  SALES: 'sales',
  DOCUMENTATION: 'documentation',
  ADMIN: 'admin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const STAFF_ROLES: Role[] = [Role.SALES, Role.DOCUMENTATION, Role.ADMIN];

export const isStaffRole = (role: string | undefined): boolean =>
  STAFF_ROLES.includes(role as Role);

/**
 * An account starts as `initial` at registration and is converted to
 * `client` once a reservation is approved, unlocking the Client Portal.
 */
export const AccountType = {
  INITIAL: 'initial',
  CLIENT: 'client',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

/** Documentary requirement categories the buyer picks before uploading. */
export const DocType = {
  VALID_ID: 'valid_id',
  PROOF_OF_BILLING: 'proof_of_billing',
  INCOME_DOCUMENT: 'income_document',
  RESERVATION_FORM: 'reservation_form',
  BIRTH_CERTIFICATE: 'birth_certificate',
  MARRIAGE_CERTIFICATE: 'marriage_certificate',
  SPECIAL_POWER_OF_ATTORNEY: 'special_power_of_attorney',
  PROOF_OF_PAYMENT: 'proof_of_payment',
} as const;
export type DocType = (typeof DocType)[keyof typeof DocType];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.VALID_ID]: 'Valid Government-Issued ID',
  [DocType.PROOF_OF_BILLING]: 'Proof of Billing',
  [DocType.INCOME_DOCUMENT]: 'Income Document',
  [DocType.RESERVATION_FORM]: 'Reservation Form',
  [DocType.BIRTH_CERTIFICATE]: 'Birth Certificate',
  [DocType.MARRIAGE_CERTIFICATE]: 'Marriage Certificate',
  [DocType.SPECIAL_POWER_OF_ATTORNEY]: 'Special Power of Attorney',
  [DocType.PROOF_OF_PAYMENT]: 'Proof of Reservation Payment',
};

/**
 * The checklist staff work against before approving a reservation. The other
 * document types remain uploadable but are situational (a Special Power of
 * Attorney only applies when someone signs on the buyer's behalf, a Marriage
 * Certificate only for married buyers).
 */
export const REQUIRED_DOC_TYPES: DocType[] = [
  DocType.VALID_ID,
  DocType.PROOF_OF_BILLING,
  DocType.INCOME_DOCUMENT,
  DocType.RESERVATION_FORM,
  DocType.PROOF_OF_PAYMENT,
];

/** Upload constraints taken from the manuscript's Scope and Limitation. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const;

/**
 * Levenshtein similarity thresholds.
 *
 * Deliberately tolerant: the manuscript's worked example is OCR reading
 * "JUAN DELA CRVZ" for "JUAN DELA CRUZ" (1 substitution over 14 characters,
 * ~0.93 similarity), which must land comfortably inside MATCH.
 */
export const SIMILARITY_MATCH = 0.85;
export const SIMILARITY_REVIEW = 0.7;

export const Verdict = {
  MATCH: 'match',
  REVIEW: 'review',
  MISMATCH: 'mismatch',
} as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];
