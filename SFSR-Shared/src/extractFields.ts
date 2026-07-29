/**
 * Pulls likely field values out of raw OCR text.
 *
 * Kept out of `ocr.ts` so it can be tested without a browser: that module
 * imports tesseract.js and touches `document` for PDF rendering, neither of
 * which exists under Node. Extraction is the part most likely to be wrong on a
 * real photograph, so it is the part that most needs to be testable.
 */

import type { OcrResult } from './types';

/**
 * Words that only ever appear as field captions, never as a person's name.
 *
 * Needed because Philippine IDs caption a field on one line and print its
 * value on the next. A driver's licence reads:
 *
 *   Last Name. First Name. Middle Name        <- caption
 *   PADILLA, JOSHUA ANDERSON RAYMUNDO         <- the actual name
 *
 * A regex that simply looked for "NAME" matched the caption and captured the
 * rest of the caption as the value, so every licence reported its holder as
 * "First Name. Middle Name" and failed the Stage 2 comparison at ~20%.
 */
const NAME_CAPTION_WORDS =
  /\b(?:LAST|FIRST|MIDDLE|GIVEN|FULL|MAIDEN|SUR)?\s*NAMES?\b|\bSURNAME\b|\bAPELYIDO\b|\bPANGALAN\b|\bMGA\b|\bSUFFIX\b|\bREGISTERED OWNER\b|\bRECEIVED FROM\b/gi;

/** Captions that introduce a name, whether or not the value follows inline. */
const NAME_LABEL =
  /\b(?:NAME|PANGALAN|APELYIDO|REGISTERED OWNER|RECEIVED FROM)\b\s*[:.\-]?\s*(.*)$/i;

/**
 * Captions that introduce an identifier. A licence prints "License No." above
 * a row holding the number, the expiry date and the agency code side by side.
 */
const ID_LABEL =
  /\b(?:ID|CRN|LICENSE|LIC|ACCOUNT|ACCT|REFERENCE|REF|REGISTRY|OR|PIN|PSN)\.?\s*(?:NO|NUMBER|#)\.?\s*[:\-]?\s*(.*)$/i;

/** An identifier carries digits; a caption like "Expiration Date" does not. */
const ID_VALUE = /\b([A-Z0-9][A-Z0-9-]{3,24})\b/;

const DATE =
  /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2}|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s+\d{1,2},?\s+\d{4})\b/i;

const ADDRESS_LABEL =
  /\b(?:ADDRESS|TIRAHAN|SERVICE ADDRESS|RESIDENCE)\b\s*[:\-]?\s*(.*)$/i;

/**
 * True when a line is only a caption, with no value of its own.
 *
 * Strip the caption vocabulary and punctuation; a real name leaves plenty of
 * letters behind, a caption leaves almost none.
 */
export function isCaptionOnly(text: string): boolean {
  const residue = text.replace(NAME_CAPTION_WORDS, '').replace(/[^A-Za-z]/g, '');
  return residue.length < 3;
}

export function extractFields(rawText: string): OcrResult['extracted'] {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const extracted: OcrResult['extracted'] = {};

  // Name: take the value from the same line when there is one, and from the
  // line below when the caption stands alone.
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(NAME_LABEL);
    if (!match) continue;

    const inline = match[1]?.trim() ?? '';
    if (inline.length >= 3 && !isCaptionOnly(inline)) {
      extracted.fullName = inline;
      break;
    }

    const next = lines[i + 1]?.trim() ?? '';
    if (next.length >= 3 && !isCaptionOnly(next)) {
      extracted.fullName = next;
      break;
    }
  }

  // Fallback: the longest all-caps line is almost always the name on an ID.
  if (!extracted.fullName) {
    const capsLines = lines.filter(
      (line) =>
        /^[A-Z\s.,'-]{6,60}$/.test(line) &&
        /[A-Z]{2,}/.test(line) &&
        !isCaptionOnly(line),
    );
    if (capsLines.length) {
      extracted.fullName = capsLines.sort((a, b) => b.length - a.length)[0];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(ID_LABEL);
    if (!match) continue;

    const inline = (match[1] ?? '').match(ID_VALUE)?.[1];
    if (inline && /\d/.test(inline)) {
      extracted.idNumber = inline.trim();
      break;
    }

    const below = (lines[i + 1] ?? '').match(ID_VALUE)?.[1];
    if (below && /\d/.test(below)) {
      extracted.idNumber = below.trim();
      break;
    }
  }

  const dateMatch = rawText.match(DATE);
  if (dateMatch?.[1]) extracted.date = dateMatch[1].trim();

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(ADDRESS_LABEL);
    if (!match) continue;

    const inline = (match[1] ?? '').trim();
    if (inline.length >= 5) {
      extracted.address = inline;
      break;
    }

    const below = (lines[i + 1] ?? '').trim();
    if (below.length >= 5) {
      extracted.address = below;
      break;
    }
  }

  return extracted;
}
