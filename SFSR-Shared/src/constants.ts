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

/**
 * Documentary requirement categories the buyer picks before uploading.
 *
 * Order matters: the uploader renders `Object.values(DocType)` directly, so this
 * is the order of the dropdown. `OTHER_SUPPORTING` is deliberately last — it is
 * the fallback, and a fallback offered early gets picked early.
 *
 * `TIN_DOCUMENT` is separate from `INCOME_DOCUMENT` because `DATABASE.doc`
 * Step 8 lists "BIR Form No. 1904 / TIN" as its own requirement, distinct from
 * "Certificate of Employment / Proof of Income". They are genuinely different
 * documents: BIR Form 1904 registers a taxpayer and states no income at all,
 * while BIR Form 2316 certifies compensation. Collapsing them meant a 1904 was
 * classified as proof of income, which is the opposite of what it proves.
 */
export const DocType = {
  VALID_ID: 'valid_id',
  PROOF_OF_BILLING: 'proof_of_billing',
  INCOME_DOCUMENT: 'income_document',
  TIN_DOCUMENT: 'tin_document',
  RESERVATION_FORM: 'reservation_form',
  BIRTH_CERTIFICATE: 'birth_certificate',
  MARRIAGE_CERTIFICATE: 'marriage_certificate',
  SPECIAL_POWER_OF_ATTORNEY: 'special_power_of_attorney',
  PROOF_OF_PAYMENT: 'proof_of_payment',
  OTHER_SUPPORTING: 'other_supporting',
} as const;
export type DocType = (typeof DocType)[keyof typeof DocType];

/**
 * Categories with no keyword signature, so Stage 1 cannot check them.
 *
 * Only `OTHER_SUPPORTING` qualifies, and by definition: the whole point of a
 * catch-all is that its contents are not known in advance, so there is nothing
 * to match against. `validateDocument` reports Stage 1 as *not applicable* for
 * these rather than as passed — a distinction that matters, because "we did not
 * check" and "we checked and it was fine" must never render the same way.
 */
export const UNCLASSIFIABLE_DOC_TYPES: DocType[] = [DocType.OTHER_SUPPORTING];

export const isUnclassifiable = (docType: DocType): boolean =>
  UNCLASSIFIABLE_DOC_TYPES.includes(docType);

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
  [DocType.INCOME_DOCUMENT]: 'Certificate of Employment / Proof of Income',
  [DocType.TIN_DOCUMENT]: 'BIR Form No. 1904 / TIN',
  [DocType.RESERVATION_FORM]: 'Reservation Form',
  [DocType.BIRTH_CERTIFICATE]: 'Birth Certificate',
  [DocType.MARRIAGE_CERTIFICATE]: 'Marriage Certificate',
  [DocType.SPECIAL_POWER_OF_ATTORNEY]: 'Special Power of Attorney',
  [DocType.PROOF_OF_PAYMENT]: 'Proof of Reservation Payment',
  [DocType.OTHER_SUPPORTING]: 'Other Supporting Document',
};

/**
 * The checklist staff work against before approving a reservation. The other
 * document types remain uploadable but are situational (a Special Power of
 * Attorney only applies when someone signs on the buyer's behalf, a Marriage
 * Certificate only for married buyers).
 *
 * `TIN_DOCUMENT` is deliberately NOT here, and the decision is genuinely
 * arguable: `DATABASE.doc` Step 8 lists "BIR Form No. 1904 / TIN" without the
 * "(if applicable)" that qualifies the Marriage Certificate and the Special
 * Power of Attorney, which reads as required — but Step 1 of the same document
 * prints "TIN: ___________" with no asterisk, and every required field there
 * carries one. The document contradicts itself.
 *
 * Left situational because making it required immediately blocks approval for
 * every reservation already in the database, and a checklist that grows a new
 * mandatory row retroactively looks like a bug to the staff using it. Adding
 * `DocType.TIN_DOCUMENT` to this array is the only change needed to reverse it.
 *
 * `OTHER_SUPPORTING` must never be listed here. It has no signature, so
 * "an approved Other Supporting Document exists" is a requirement that any file
 * at all can satisfy.
 */
export const REQUIRED_DOC_TYPES: DocType[] = [
  DocType.VALID_ID,
  DocType.PROOF_OF_BILLING,
  DocType.INCOME_DOCUMENT,
  DocType.RESERVATION_FORM,
  DocType.PROOF_OF_PAYMENT,
];

/**
 * How a reservation fee was paid, from the reservation specification.
 *
 * Captured with the receipt because the receipt alone does not say which
 * channel produced it, and Billing reconciles against a bank or wallet feed
 * per channel.
 */
export const PaymentChannel = {
  BANK_DEPOSIT: 'bank_deposit',
  ONLINE_BANKING: 'online_banking',
  GCASH: 'gcash',
  MAYA: 'maya',
  CHECK: 'check',
  CASH: 'cash',
} as const;
export type PaymentChannel =
  (typeof PaymentChannel)[keyof typeof PaymentChannel];

export const PAYMENT_CHANNEL_LABELS: Record<PaymentChannel, string> = {
  [PaymentChannel.BANK_DEPOSIT]: 'Bank Deposit',
  [PaymentChannel.ONLINE_BANKING]: 'Online Banking',
  [PaymentChannel.GCASH]: 'GCash',
  [PaymentChannel.MAYA]: 'Maya',
  [PaymentChannel.CHECK]: 'Check',
  [PaymentChannel.CASH]: 'Cash',
};

/**
 * Query page sizes and upper bounds.
 *
 * Kept here, not beside the hooks that use them, because `scripts/measureReads.ts`
 * reports the read cost of each screen and has to measure the same numbers the
 * app actually uses. When they were duplicated, the page size dropped to 24 and
 * the report kept confidently printing 60.
 *
 * Firestore bills one read per document every time a listener attaches, so each
 * of these is a per-attach price.
 */

/** Units held in the catalogue's search listener. */
export const CATALOGUE_PAGE_SIZE = 24;

/**
 * Units shown when a type is opened, before "Show more floors".
 *
 * A multiple of four so a page break lands on a floor boundary — a floor holds
 * up to four units of one type. Six rows fit a screen without scrolling; sixteen
 * was more than a buyer could take in.
 */
export const FLOOR_PAGE_SIZE = 24;

/** Ceilings for collections that are small now and unbounded in principle. */
export const MAX_PROJECTS = 50;
export const MAX_UNIT_TYPES = 50;
export const MAX_DOCUMENTS_PER_RESERVATION = 100;
export const MAX_RESERVATIONS = 200;
export const MAX_STAFF = 200;
export const MAX_AUDIT_ENTRIES = 50;

/**
 * Formats from the manuscript; size from `DATABASE.doc` Steps 7 and 8.
 *
 * The manuscript lists PDF, JPG, JPEG and PNG but names no size — only "a
 * maximum file size specified by the company". `DATABASE.doc` is the company
 * specifying it, and says 10 MB twice. So the two do not disagree, and there
 * is nothing here to decide.
 *
 * This was 3 MB, with a comment attributing that to the manuscript's Scope and
 * Limitation. The manuscript contains no such figure. The practical cost was
 * real: a phone photo of an ID is routinely 4-8 MB, so the system refused
 * documents the specification promises to accept, before OCR ever ran.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
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
