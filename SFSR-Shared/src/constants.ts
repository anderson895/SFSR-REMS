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

/**
 * Lifecycle of a site-visit ("tripping") request.
 *
 * Separate from ReservationStatus on purpose: a tripping is an enquiry, not an
 * application for a unit. Nobody is held, nothing is reserved, and a declined
 * tripping has none of the consequences a rejected reservation does.
 */
export const TrippingStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type TrippingStatus =
  (typeof TrippingStatus)[keyof typeof TrippingStatus];

/** Time bands the sales office accepts site visits in. */
export const TRIPPING_SLOTS = [
  '09:00 AM – 11:00 AM',
  '11:00 AM – 01:00 PM',
  '01:00 PM – 03:00 PM',
  '03:00 PM – 05:00 PM',
] as const;

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

/**
 * Unit types offered, cheapest first.
 *
 * Listed explicitly because Firestore has no DISTINCT. The catalogue summarises
 * each type with an aggregation query instead of reading every unit, so it has
 * to know which types to ask about. Must match the types produced by
 * `scripts/unitData.ts` — a type missing here is invisible in the catalogue.
 */
export const UNIT_TYPES = ['Studio', '1BR', '2BR', '3BR'] as const;

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

/**
 * Specific government IDs the system can recognise.
 *
 * `DocType.VALID_ID` alone is too coarse: it accepts anything that looks like
 * an ID, so a buyer who picks "Driver's License" can upload a PhilHealth card
 * and pass. Naming the exact card lets Stage 1 reject that.
 *
 * This list is deliberately wider than what is *accepted* — see
 * `ACCEPTED_ID_TYPES`. A PhilHealth card is not a primary ID for a property
 * transaction, but the system still has to recognise one in order to say
 * "this is a PhilHealth ID, not the Driver's License you selected" rather than
 * the useless "this does not look like a valid ID".
 */
export const IdType = {
  PHILSYS: 'philsys',
  PASSPORT: 'passport',
  DRIVERS_LICENSE: 'drivers_license',
  UMID: 'umid',
  PRC_ID: 'prc_id',
  POSTAL_ID: 'postal_id',
  VOTERS_ID: 'voters_id',
  // Recognised so they can be named when rejected, never offered as a choice.
  PHILHEALTH: 'philhealth',
  TIN_ID: 'tin_id',
  SENIOR_CITIZEN: 'senior_citizen',
  PWD_ID: 'pwd_id',
  BARANGAY_ID: 'barangay_id',
} as const;
export type IdType = (typeof IdType)[keyof typeof IdType];

export const ID_TYPE_LABELS: Record<IdType, string> = {
  [IdType.PHILSYS]: 'PhilSys / National ID',
  [IdType.PASSPORT]: 'Philippine Passport',
  [IdType.DRIVERS_LICENSE]: "Driver's License (LTO)",
  [IdType.UMID]: 'UMID (SSS/GSIS)',
  [IdType.PRC_ID]: 'PRC ID',
  [IdType.POSTAL_ID]: 'Postal ID',
  [IdType.VOTERS_ID]: "Voter's ID",
  [IdType.PHILHEALTH]: 'PhilHealth ID',
  [IdType.TIN_ID]: 'TIN ID',
  [IdType.SENIOR_CITIZEN]: 'Senior Citizen ID',
  [IdType.PWD_ID]: 'PWD ID',
  [IdType.BARANGAY_ID]: 'Barangay ID',
};

/**
 * The primary IDs a buyer may actually submit.
 *
 * Restricted to cards that carry a photograph, a signature and a verifiable
 * issuing authority, which is what a property transaction requires. The
 * secondary IDs above are recognised but refused.
 */
export const ACCEPTED_ID_TYPES: IdType[] = [
  IdType.PHILSYS,
  IdType.PASSPORT,
  IdType.DRIVERS_LICENSE,
  IdType.UMID,
  IdType.PRC_ID,
  IdType.POSTAL_ID,
  IdType.VOTERS_ID,
];

export const isAcceptedIdType = (value: string | undefined): boolean =>
  ACCEPTED_ID_TYPES.includes(value as IdType);

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
