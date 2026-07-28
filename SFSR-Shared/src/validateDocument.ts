/**
 * The two-stage automated document validation described in the study.
 *
 *   Stage 1 — Document Type Validation
 *     Does this file actually look like the document category the user chose?
 *     Catches the common case of a buyer uploading a payslip under "Valid ID".
 *
 *   Stage 2 — Information Validation
 *     Does the name printed on the document match the registered buyer, allowing
 *     for OCR noise? This is where Levenshtein Distance does its work.
 *
 * The result is a recommendation. Per the manuscript's limitations, final
 * acceptance or rejection always rests with authorised personnel.
 */

import {
  DOC_TYPE_LABELS,
  type DocType,
  DocType as DocTypes,
  ID_TYPE_LABELS,
  type IdType,
  SIMILARITY_MATCH,
  SIMILARITY_REVIEW,
  Verdict,
  isAcceptedIdType,
} from './constants';
import { scoreDocumentType, scoreIdType } from './docPatterns';
import { bestWindowSimilarity, tokenAlignedComparison } from './levenshtein';
import type { OcrResult, ValidationResult } from './types';

/** Below this, we do not believe the document is of the selected type. */
const TYPE_ACCEPT_THRESHOLD = 0.5;

export interface ValidateInput {
  ocr: OcrResult;
  /** The category the user selected before uploading. */
  selectedType: DocType;
  /**
   * The specific government ID the user claimed this is.
   *
   * Only meaningful when `selectedType` is Valid ID. Without it the check
   * degrades to "is this any ID at all", which is what Stage 1 already does.
   */
  selectedIdType?: IdType | null;
  /** The buyer's registered full name, from their profile or the reservation. */
  registeredName: string;
}

export function validateDocument({
  ocr,
  selectedType,
  selectedIdType,
  registeredName,
}: ValidateInput): ValidationResult {
  const scores = scoreDocumentType(ocr.rawText);
  const selectedScore = scores.find((s) => s.docType === selectedType);
  const best = scores[0];

  const typeScore = selectedScore?.score ?? 0;
  const typeMatch = typeScore >= TYPE_ACCEPT_THRESHOLD;

  // Only report a "detected" type when something else scored clearly better;
  // otherwise the suggestion is noise and would confuse the reviewer.
  const detectedType =
    best && best.score >= TYPE_ACCEPT_THRESHOLD && best.score > typeScore
      ? best.docType
      : null;

  // --- Stage 1 gate -------------------------------------------------------
  // If the document is not of the expected type, stop here. Comparing names on
  // the wrong document would produce a meaningless similarity score.
  if (!typeMatch) {
    const suggestion = detectedType
      ? ` It looks more like a ${DOC_TYPE_LABELS[detectedType]}.`
      : '';
    return {
      typeMatch: false,
      typeScore,
      detectedType,
      idTypeMatch: null,
      nameDistance: -1,
      nameSimilarity: 0,
      comparedAgainst: registeredName,
      matchedText: '',
      verdict: Verdict.MISMATCH,
      message:
        `This file does not appear to be a ${DOC_TYPE_LABELS[selectedType]}.` +
        `${suggestion} Please upload the correct document.`,
    };
  }

  // --- Stage 1b gate: which ID is it? -------------------------------------
  // Stage 1 only established that this is *an* ID. A buyer who selected
  // "Driver's License" and uploaded a PhilHealth card has passed it, because
  // both are IDs. This is the check that separates them.
  const idCheck = checkIdType(selectedType, selectedIdType, ocr.rawText);

  if (idCheck && !idCheck.idTypeMatch) {
    return {
      typeMatch: true,
      typeScore,
      detectedType: null,
      idTypeMatch: false,
      idTypeScore: idCheck.idTypeScore,
      detectedIdType: idCheck.detectedIdType,
      nameDistance: -1,
      nameSimilarity: 0,
      comparedAgainst: registeredName,
      matchedText: '',
      verdict: Verdict.MISMATCH,
      message: idCheck.message,
    };
  }

  // --- Stage 2: information validation ------------------------------------
  // Prefer the name field OCR isolated. If it found none, fall back to sliding
  // the registered name across the whole page — slower, but it still finds the
  // name on documents with layouts our field extraction does not recognise.
  // Both paths compare tokens rather than flat strings, because IDs print
  // names surname-first while buyers register given-name-first.
  const extractedName = ocr.extracted.fullName;
  const comparison = extractedName
    ? tokenAlignedComparison(registeredName, extractedName)
    : bestWindowSimilarity(registeredName, ocr.rawText);

  let message: string;
  if (comparison.verdict === Verdict.MATCH) {
    message =
      `Name matches the registered buyer ` +
      `(${(comparison.similarity * 100).toFixed(1)}% similar, ` +
      `${comparison.distance} character difference).`;
  } else if (comparison.verdict === Verdict.REVIEW) {
    message =
      `Name is close but not conclusive ` +
      `(${(comparison.similarity * 100).toFixed(1)}% similar, ` +
      `${comparison.distance} character difference). Manual review required.`;
  } else {
    message =
      `The name on this document does not match the registered buyer ` +
      `(${(comparison.similarity * 100).toFixed(1)}% similar). ` +
      `Please verify manually.`;
  }

  return {
    typeMatch: true,
    typeScore,
    detectedType: null,
    idTypeMatch: idCheck ? true : null,
    idTypeScore: idCheck?.idTypeScore,
    detectedIdType: idCheck?.detectedIdType ?? null,
    nameDistance: comparison.distance,
    nameSimilarity: Number(comparison.similarity.toFixed(4)),
    comparedAgainst: comparison.normalizedA,
    matchedText: comparison.normalizedB,
    verdict: comparison.verdict,
    message,
  };
}

interface IdCheck {
  idTypeMatch: boolean;
  idTypeScore: number;
  detectedIdType: IdType | null;
  message: string;
}

/**
 * Stage 1b — confirms a Valid ID is the specific card the buyer claimed.
 *
 * Returns null when the check does not apply: any category other than Valid
 * ID, or a Valid ID uploaded without naming which one. Returning null rather
 * than a passing result matters — it is how the caller reports "not checked"
 * instead of "checked and fine".
 *
 * Two ways to fail, and they need different messages because they send the
 * buyer to different places:
 *
 *   - the card is recognisably something else — name it, so they know what
 *     they actually picked up
 *   - the card is not recognisable at all — likely a poor scan, so ask for a
 *     clearer one rather than accusing them of the wrong document
 */
function checkIdType(
  selectedType: DocType,
  selectedIdType: IdType | null | undefined,
  rawText: string,
): IdCheck | null {
  if (selectedType !== DocTypes.VALID_ID || !selectedIdType) return null;

  const scores = scoreIdType(rawText);
  const selected = scores.find((s) => s.idType === selectedIdType);
  const best = scores[0];

  const idTypeScore = selected?.score ?? 0;
  const bestIsOther =
    best && best.score >= TYPE_ACCEPT_THRESHOLD && best.idType !== selectedIdType;

  if (idTypeScore >= TYPE_ACCEPT_THRESHOLD && !bestIsOther) {
    return {
      idTypeMatch: true,
      idTypeScore,
      detectedIdType: selectedIdType,
      message: '',
    };
  }

  const selectedLabel = ID_TYPE_LABELS[selectedIdType];

  if (bestIsOther) {
    const detected = best.idType;
    const refusal = isAcceptedIdType(detected)
      ? `If you meant to submit it, choose ${ID_TYPE_LABELS[detected]} instead.`
      : `${ID_TYPE_LABELS[detected]} is not accepted as a primary ID for this transaction.`;

    return {
      idTypeMatch: false,
      idTypeScore,
      detectedIdType: detected,
      message:
        `You selected ${selectedLabel}, but this looks like a ` +
        `${ID_TYPE_LABELS[detected]}. ${refusal}`,
    };
  }

  return {
    idTypeMatch: false,
    idTypeScore,
    detectedIdType: null,
    message:
      `This does not read as a ${selectedLabel}. Check that you selected the ` +
      `right ID, and upload a clearer photo where the header and issuing ` +
      `office are legible.`,
  };
}

/** Human-readable label for a verdict, used by both apps' badges. */
export function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case Verdict.MATCH:
      return 'Validated';
    case Verdict.REVIEW:
      return 'Needs Review';
    default:
      return 'Mismatch';
  }
}

export { SIMILARITY_MATCH, SIMILARITY_REVIEW };
