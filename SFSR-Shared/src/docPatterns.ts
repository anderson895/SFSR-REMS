/**
 * Keyword signatures used by Stage 1 of validation (Document Type Validation).
 *
 * Each document category lists phrases that reliably appear on that kind of
 * Philippine document. Matching is fuzzy — see `scoreDocumentType` — because
 * OCR routinely mangles a character or two in a heading.
 */

import { DocType, IdType } from './constants';
import { normalizeText, similarityRatio } from './levenshtein';

export interface DocPattern {
  docType: DocType;
  /** Strong signals: seeing one of these is close to conclusive. */
  primary: string[];
  /** Weaker supporting signals, worth partial credit. */
  secondary: string[];
}

export const DOC_PATTERNS: DocPattern[] = [
  {
    docType: DocType.VALID_ID,
    primary: [
      'REPUBLIC OF THE PHILIPPINES',
      'PHILIPPINE IDENTIFICATION CARD',
      'PHILSYS',
      'UNIFIED MULTI PURPOSE ID',
      'UMID',
      'DRIVERS LICENSE',
      'PASSPORT',
      'POSTAL IDENTITY CARD',
      'PROFESSIONAL REGULATION COMMISSION',
      'SOCIAL SECURITY SYSTEM',
      'VOTERS IDENTIFICATION CARD',
    ],
    secondary: [
      'DATE OF BIRTH',
      'PLACE OF BIRTH',
      'NATIONALITY',
      'SIGNATURE',
      'ID NO',
      'CRN',
      'SEX',
      'BLOOD TYPE',
      'EXPIRATION DATE',
    ],
  },
  {
    docType: DocType.PROOF_OF_BILLING,
    primary: [
      'STATEMENT OF ACCOUNT',
      'BILLING STATEMENT',
      'MERALCO',
      'MANILA WATER',
      'MAYNILAD',
      'PLDT',
      'GLOBE TELECOM',
      'CONVERGE',
      'ELECTRIC BILL',
    ],
    secondary: [
      'BILLING PERIOD',
      'ACCOUNT NUMBER',
      'DUE DATE',
      'AMOUNT DUE',
      'SERVICE ADDRESS',
      'TOTAL AMOUNT',
      'PREVIOUS READING',
    ],
  },
  {
    docType: DocType.INCOME_DOCUMENT,
    /**
     * The BIR form numbers are spelled out rather than matched as a bare
     * "BIR FORM".
     *
     * That generic needle used to sit here, and it made this category swallow
     * every BIR form there is — including Form 1904, which registers a taxpayer
     * and certifies no income whatsoever. A 1904 was therefore classified as
     * proof of income, which is the opposite of what it proves.
     *
     * 2316 certifies compensation paid; 1700 and 1701 are income tax returns.
     * Those are income documents. 1904 is not, and now lives in its own
     * category below.
     */
    primary: [
      'CERTIFICATE OF EMPLOYMENT',
      'INCOME TAX RETURN',
      'BIR FORM NO 2316',
      'BIR FORM 2316',
      'BIR FORM NO 1700',
      'BIR FORM NO 1701',
      'PAYSLIP',
      'PAY SLIP',
      'CERTIFICATE OF COMPENSATION PAYMENT',
      'BUSINESS PERMIT',
    ],
    secondary: [
      'GROSS INCOME',
      'BASIC SALARY',
      'NET PAY',
      'MONTHLY SALARY',
      'WITHHOLDING TAX',
      'EMPLOYER',
      'POSITION',
    ],
  },
  {
    docType: DocType.TIN_DOCUMENT,
    /**
     * BIR Form 1904 -- "Application for Registration for One-Time Taxpayer and
     * Person Registering under E.O. 98".
     *
     * Note that "TIN" is never used as a needle on its own. `containsFuzzy`
     * slides a window the length of the phrase, so a three-letter needle
     * matches inside PRINTING, CERTIFICATE, and most of an English page. The
     * long form of the phrase is what discriminates.
     *
     * Form 1901 (self-employed registration) scores here too, because
     * "BIR FORM NO 1904" and "BIR FORM NO 1901" differ by two characters and the
     * fuzzy threshold is 85%. That is the right outcome: 1901 is also a
     * registration form, not an income document.
     */
    primary: [
      'BIR FORM NO 1904',
      'BIR FORM 1904',
      'TAXPAYER IDENTIFICATION NUMBER',
      'APPLICATION FOR REGISTRATION',
      'BUREAU OF INTERNAL REVENUE',
    ],
    secondary: [
      'REVENUE DISTRICT OFFICE',
      'RDO CODE',
      'ONE TIME TAXPAYER',
      'TAXPAYER TYPE',
      'DEPARTMENT OF FINANCE',
      'REGISTERED ADDRESS',
    ],
  },
  {
    docType: DocType.RESERVATION_FORM,
    primary: [
      'RESERVATION AGREEMENT',
      'RESERVATION FORM',
      'BUYERS INFORMATION SHEET',
    ],
    secondary: [
      'UNIT NO',
      'PROJECT NAME',
      'RESERVATION FEE',
      'TOTAL CONTRACT PRICE',
      'TERMS OF PAYMENT',
      'BUYER',
    ],
  },
  {
    docType: DocType.BIRTH_CERTIFICATE,
    primary: [
      'CERTIFICATE OF LIVE BIRTH',
      'PHILIPPINE STATISTICS AUTHORITY',
      'NATIONAL STATISTICS OFFICE',
      'CIVIL REGISTRY',
    ],
    secondary: [
      'DATE OF BIRTH',
      'PLACE OF BIRTH',
      'NAME OF MOTHER',
      'NAME OF FATHER',
      'MAIDEN NAME',
      'REGISTRY NO',
    ],
  },
  {
    docType: DocType.MARRIAGE_CERTIFICATE,
    primary: [
      'CERTIFICATE OF MARRIAGE',
      'MARRIAGE CONTRACT',
      'PHILIPPINE STATISTICS AUTHORITY',
    ],
    secondary: [
      'HUSBAND',
      'WIFE',
      'DATE OF MARRIAGE',
      'PLACE OF MARRIAGE',
      'SOLEMNIZING OFFICER',
      'MARRIAGE LICENSE NO',
    ],
  },
  {
    docType: DocType.SPECIAL_POWER_OF_ATTORNEY,
    primary: ['SPECIAL POWER OF ATTORNEY', 'KNOW ALL MEN BY THESE PRESENTS'],
    secondary: [
      'ATTORNEY IN FACT',
      'PRINCIPAL',
      'NOTARY PUBLIC',
      'DOC NO',
      'PAGE NO',
      'BOOK NO',
      'SERIES OF',
    ],
  },
  {
    docType: DocType.PROOF_OF_PAYMENT,
    primary: [
      'OFFICIAL RECEIPT',
      'ACKNOWLEDGEMENT RECEIPT',
      'DEPOSIT SLIP',
      'PROOF OF PAYMENT',
      'TRANSACTION RECEIPT',
      'REFERENCE NO',
    ],
    secondary: [
      'AMOUNT PAID',
      'PAYMENT DATE',
      'RECEIVED FROM',
      'GCASH',
      'BANK TRANSFER',
      'TRANSACTION ID',
    ],
  },
  // DocType.OTHER_SUPPORTING has no entry here, and cannot have one: a catch-all
  // holds documents nobody enumerated, so there is no phrase that appears on
  // "one of them". Its absence is what makes it absent from scoreDocumentType's
  // results, which is what stops the system ever suggesting "this looks more
  // like an Other Supporting Document" -- a suggestion that would mean nothing.
  // See `isUnclassifiable` in constants.ts and the Stage 1 branch in
  // validateDocument.ts.
];

/**
 * Every category that Stage 1 can actually check.
 *
 * Derived from `DOC_PATTERNS` rather than typed out, so a new `DocType` added
 * without a signature shows up here as missing instead of silently scoring zero
 * against itself and being rejected on upload. `npm run check:algorithms`
 * asserts that the only gap is the intended one.
 */
export const CLASSIFIABLE_DOC_TYPES: DocType[] = DOC_PATTERNS.map(
  (p) => p.docType,
);

/**
 * Keyword signatures for individual government IDs.
 *
 * `DOC_PATTERNS` answers "is this an ID at all?". This answers "*which* ID is
 * it?", which is a harder question: every card here says REPUBLIC OF THE
 * PHILIPPINES and carries a name, a photo and a signature. Only the issuing
 * authority and the card's own field labels tell them apart, so those are the
 * only things listed below — shared furniture would score every card equally
 * and discriminate nothing.
 *
 * Keywords are kept long on purpose. `containsFuzzy` slides a window the
 * length of the phrase, so a three-letter needle like "TIN" matches inside
 * "PRINTING" and a short one like "PWD" inside any similar trigram. Nothing
 * here is shorter than `MIN_KEYWORD_LENGTH`, and `scoreIdType` drops anything
 * that is, so a well-meaning future addition cannot quietly poison the scores.
 */
export interface IdPattern {
  idType: IdType;
  primary: string[];
  secondary: string[];
}

/** Below this a fuzzy window match is noise rather than evidence. */
export const MIN_KEYWORD_LENGTH = 6;

export const ID_PATTERNS: IdPattern[] = [
  {
    idType: IdType.PHILSYS,
    primary: [
      'PHILIPPINE IDENTIFICATION CARD',
      'PAMBANSANG PAGKAKAKILANLAN',
      'PHILSYS CARD NUMBER',
      'PHILSYS',
    ],
    // The PhilSys card labels its fields in Filipino, which no other ID does.
    secondary: [
      'APELYIDO',
      'MGA PANGALAN',
      'PETSA NG KAPANGANAKAN',
      'TIRAHAN',
      'KASARIAN',
    ],
  },
  {
    idType: IdType.PASSPORT,
    primary: [
      'PASAPORTE',
      'DEPARTMENT OF FOREIGN AFFAIRS',
      'PASSPORT NO',
      'KAGAWARAN NG UGNAYANG PANLABAS',
    ],
    secondary: [
      'PLACE OF ISSUE',
      'DATE OF ISSUE',
      'ISSUING AUTHORITY',
      'PLACE OF BIRTH',
      'DATE OF EXPIRY',
    ],
  },
  {
    idType: IdType.DRIVERS_LICENSE,
    primary: [
      'DRIVERS LICENSE',
      'LAND TRANSPORTATION OFFICE',
      'NON PROFESSIONAL',
    ],
    secondary: [
      'AGENCY CODE',
      'RESTRICTIONS',
      'CONDITIONS',
      'LICENSE NO',
      'BLOOD TYPE',
      'EYES COLOR',
    ],
  },
  {
    idType: IdType.UMID,
    primary: [
      'UNIFIED MULTI PURPOSE',
      'SOCIAL SECURITY SYSTEM',
      'GOVERNMENT SERVICE INSURANCE SYSTEM',
    ],
    secondary: ['COMMON REFERENCE NUMBER', 'PAG IBIG', 'CRN NO'],
  },
  {
    idType: IdType.PRC_ID,
    primary: [
      'PROFESSIONAL REGULATION COMMISSION',
      'PROFESSIONAL IDENTIFICATION CARD',
    ],
    secondary: [
      'REGISTRATION NO',
      'VALID UNTIL',
      'PROFESSION',
      'LICENSE NUMBER',
    ],
  },
  {
    idType: IdType.POSTAL_ID,
    primary: [
      'POSTAL IDENTITY CARD',
      'PHILIPPINE POSTAL CORPORATION',
      'PHLPOST',
    ],
    secondary: ['POSTAL ID', 'POSTAL REFERENCE NUMBER'],
  },
  {
    idType: IdType.VOTERS_ID,
    primary: [
      'VOTERS IDENTIFICATION CARD',
      'COMMISSION ON ELECTIONS',
      'COMELEC',
    ],
    secondary: [
      'PRECINCT NO',
      'VOTERS IDENTIFICATION NUMBER',
      'CITY MUNICIPALITY',
    ],
  },

  // --- recognised so they can be named when refused, never offered ---------
  {
    idType: IdType.PHILHEALTH,
    primary: [
      'PHILIPPINE HEALTH INSURANCE CORPORATION',
      'PHILHEALTH',
      'PHILHEALTH IDENTIFICATION NUMBER',
    ],
    secondary: ['MEMBER SINCE', 'PHILHEALTH NO'],
  },
  {
    idType: IdType.TIN_ID,
    primary: ['TAXPAYER IDENTIFICATION NUMBER', 'BUREAU OF INTERNAL REVENUE'],
    secondary: ['REVENUE DISTRICT', 'TAXPAYER NAME'],
  },
  {
    idType: IdType.SENIOR_CITIZEN,
    primary: [
      'SENIOR CITIZEN IDENTIFICATION CARD',
      'OFFICE FOR SENIOR CITIZENS AFFAIRS',
      'SENIOR CITIZEN',
    ],
    secondary: ['OSCA ID', 'DATE ISSUED'],
  },
  {
    idType: IdType.PWD_ID,
    primary: [
      'PERSON WITH DISABILITY',
      'NATIONAL COUNCIL ON DISABILITY AFFAIRS',
    ],
    secondary: ['TYPE OF DISABILITY', 'PWD ID NO'],
  },
  {
    idType: IdType.BARANGAY_ID,
    primary: [
      'BARANGAY IDENTIFICATION CARD',
      'BARANGAY CLEARANCE',
      'OFFICE OF THE BARANGAY',
    ],
    secondary: ['PUNONG BARANGAY', 'BARANGAY CAPTAIN'],
  },
];

/**
 * Fuzzy keyword search: is `phrase` present anywhere in `text`?
 *
 * A plain `includes` check fails the moment OCR turns "OFFICIAL RECEIPT" into
 * "OFFlCIAL RECEIPT", so instead we slide a same-length window across the text
 * and accept the phrase when any window is at least 85% similar.
 */
function containsFuzzy(text: string, phrase: string): boolean {
  const needle = normalizeText(phrase);
  if (!needle) return false;
  if (text.includes(needle)) return true;

  const window = needle.length;
  if (text.length < window) return false;

  // Step in quarter-window strides: fine enough to catch a shifted match,
  // coarse enough to stay fast on a full page of OCR text.
  const stride = Math.max(1, Math.floor(window / 4));
  for (let i = 0; i + window <= text.length; i += stride) {
    if (similarityRatio(needle, text.slice(i, i + window)) >= 0.85) return true;
  }
  return false;
}

export interface TypeScore {
  docType: DocType;
  score: number;
  matchedKeywords: string[];
}

/**
 * Scores OCR text against every known document signature.
 *
 * Primary hits are weighted far more heavily than secondary ones: a single
 * "CERTIFICATE OF LIVE BIRTH" is worth more than several generic field labels
 * like "DATE OF BIRTH", which appear on many documents. Results are sorted
 * best-first.
 */
export function scoreDocumentType(rawText: string): TypeScore[] {
  const text = normalizeText(rawText);

  const scores = DOC_PATTERNS.map(({ docType, primary, secondary }) => {
    const matchedKeywords: string[] = [];

    let primaryHits = 0;
    for (const phrase of primary) {
      if (containsFuzzy(text, phrase)) {
        primaryHits++;
        matchedKeywords.push(phrase);
      }
    }

    let secondaryHits = 0;
    for (const phrase of secondary) {
      if (containsFuzzy(text, phrase)) {
        secondaryHits++;
        matchedKeywords.push(phrase);
      }
    }

    // One primary hit alone reaches 0.6 — enough to clear the acceptance bar
    // in validateDocument. Secondary hits top up the remaining 0.4.
    const primaryScore = Math.min(1, primaryHits / 1) * 0.6;
    const secondaryScore = Math.min(1, secondaryHits / 3) * 0.4;

    return {
      docType,
      score: Number((primaryScore + secondaryScore).toFixed(3)),
      matchedKeywords,
    };
  });

  return scores.sort((a, b) => b.score - a.score);
}

export interface IdScore {
  idType: IdType;
  score: number;
  matchedKeywords: string[];
}

/**
 * Scores OCR text against every known government ID.
 *
 * Same weighting as `scoreDocumentType` so the two stages read consistently:
 * one primary hit reaches 0.6, secondary hits top up the rest. Sorted
 * best-first.
 *
 * Phrases below `MIN_KEYWORD_LENGTH` are skipped rather than trusted. A short
 * needle passed to `containsFuzzy` matches almost any text of that length, so
 * including one would hand a card a primary hit it never earned — and because
 * a single primary hit clears the acceptance bar on its own, that one mistake
 * would be enough to accept the wrong ID.
 */
export function scoreIdType(rawText: string): IdScore[] {
  const text = normalizeText(rawText);

  const usable = (phrases: string[]) =>
    phrases.filter((p) => normalizeText(p).length >= MIN_KEYWORD_LENGTH);

  const scores = ID_PATTERNS.map(({ idType, primary, secondary }) => {
    const matchedKeywords: string[] = [];

    let primaryHits = 0;
    for (const phrase of usable(primary)) {
      if (containsFuzzy(text, phrase)) {
        primaryHits++;
        matchedKeywords.push(phrase);
      }
    }

    let secondaryHits = 0;
    for (const phrase of usable(secondary)) {
      if (containsFuzzy(text, phrase)) {
        secondaryHits++;
        matchedKeywords.push(phrase);
      }
    }

    const primaryScore = Math.min(1, primaryHits) * 0.6;
    const secondaryScore = Math.min(1, secondaryHits / 3) * 0.4;

    return {
      idType,
      score: Number((primaryScore + secondaryScore).toFixed(3)),
      matchedKeywords,
    };
  });

  return scores.sort((a, b) => b.score - a.score);
}
