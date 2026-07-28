/**
 * Keyword signatures used by Stage 1 of validation (Document Type Validation).
 *
 * Each document category lists phrases that reliably appear on that kind of
 * Philippine document. Matching is fuzzy — see `scoreDocumentType` — because
 * OCR routinely mangles a character or two in a heading.
 */

import { DocType } from './constants';
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
    primary: [
      'CERTIFICATE OF EMPLOYMENT',
      'INCOME TAX RETURN',
      'BIR FORM',
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
