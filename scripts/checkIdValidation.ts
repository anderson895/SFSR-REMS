/**
 * Proves Stage 1b tells one government ID from another.
 *
 *   npx tsx scripts/checkIdValidation.ts
 *
 * Stage 1 only establishes that a file is *an* ID — every card here says
 * REPUBLIC OF THE PHILIPPINES and carries a name and a photo, so a PhilHealth
 * card passes it while claiming to be a driver's licence. Stage 1b is what
 * separates them, and this is the check that it actually does.
 *
 * The fixtures are OCR text, not clean strings: they carry the character
 * damage Tesseract really produces (l/1, O/0, rn/m) so the fuzzy matcher is
 * exercised the way it will be in production rather than on ideal input.
 */

import { DocType, IdType, Verdict } from '../SFSR-Shared/src/constants';
import { scoreIdType } from '../SFSR-Shared/src/docPatterns';
import { extractFields } from '../SFSR-Shared/src/extractFields';
import type { OcrResult } from '../SFSR-Shared/src/types';
import { validateDocument } from '../SFSR-Shared/src/validateDocument';

let failures = 0;

function report(passed: boolean, label: string, detail = '') {
  console.log(
    `  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`,
  );
  if (!passed) failures++;
}

function ocrOf(rawText: string, fullName?: string): OcrResult {
  return {
    rawText,
    extracted: fullName ? { fullName } : {},
    engine: 'fixture',
    meanConfidence: 80,
    processedAt: '2026-01-01T00:00:00.000Z',
  };
}

/** Deliberately imperfect: this is what a phone photo actually OCRs to. */
const CARDS: Record<string, string> = {
  driversLicense: `REPUBLIC OF THE PHILIPPINES
    DEPARTMENT OF TRANSPORTATION
    LAND TRANSPORTATI0N OFFICE
    NON PROFESSIONAL DRIVERS LICENSE
    JUAN DELA CRUZ
    Nationality PHL  Sex M  Date of Birth 1990/05/12
    Blood Type O  Eyes Color BLACK
    Agency Code N01  Restrictions 1,2  Conditions NONE
    License No N01-23-456789  Expiration Date 2028/05/12`,

  philhealth: `REPUBLIC OF THE PHILIPPINES
    PHILIPPINE HEALTH INSURANCE CORPORATION
    PHILHEALTH IDENTIFICATION NUMBER
    JUAN DELA CRUZ
    PIN 12-345678901-2
    Date of Birth 1990/05/12
    Member Since 2015`,

  philsys: `REPUBLIKA NG PILIPINAS
    PHILIPPINE IDENTIFICATION CARD
    PAMBANSANG PAGKAKAKILANLAN
    APELYIDO Last Name DELA CRUZ
    MGA PANGALAN Given Names JUAN
    PETSA NG KAPANGANAKAN 1990/05/12
    TIRAHAN Address MAKATI CITY
    PhilSys Card Number 1234-5678-9012-3456`,

  passport: `REPUBLIKA NG PILIPINAS
    REPUBLIC OF THE PHILIPPINES
    PASAPORTE PASSPORT
    DEPARTMENT OF FOREIGN AFFAIRS
    Passport No P1234567A
    Surname DELA CRUZ  Given Names JUAN
    Nationality FILIPINO  Date of Issue 2021/03/04
    Place of Issue DFA MANILA  Date of Expiry 2031/03/03`,

  umid: `REPUBLIC OF THE PHILIPPINES
    UNIFIED MULTI PURPOSE ID
    SOCIAL SECURITY SYSTEM
    JUAN DELA CRUZ
    CRN 0111-2233445-6
    Common Reference Number
    Date of Birth 1990/05/12`,

  postal: `REPUBLIC OF THE PHILIPPINES
    PHILIPPINE POSTAL CORPORATION
    POSTAL IDENTITY CARD
    JUAN DELA CRUZ
    Postal Reference Number PRN 1234567
    Address MAKATI CITY`,

  /** A payslip — not an ID at all, so Stage 1 should stop it first. */
  payslip: `ACME CORPORATION
    PAYSLIP for the period 2026-06-01 to 2026-06-15
    Employee JUAN DELA CRUZ
    Basic Salary 45,000.00  Net Pay 38,120.55
    Withholding Tax 3,200.00  Position DEVELOPER`,
};

const NAME = 'Juan Dela Cruz';

function validate(card: string, claimed: IdType) {
  return validateDocument({
    ocr: ocrOf(CARDS[card], 'JUAN DELA CRUZ'),
    selectedType: DocType.VALID_ID,
    selectedIdType: claimed,
    registeredName: NAME,
  });
}

function main() {
  console.log('\nStage 1b — ID type discrimination\n');

  // --- each card is recognised as itself ----------------------------------
  const selfChecks: [string, IdType][] = [
    ['driversLicense', IdType.DRIVERS_LICENSE],
    ['philsys', IdType.PHILSYS],
    ['passport', IdType.PASSPORT],
    ['umid', IdType.UMID],
    ['postal', IdType.POSTAL_ID],
  ];

  for (const [card, idType] of selfChecks) {
    const r = validate(card, idType);
    report(
      r.idTypeMatch === true && r.verdict === Verdict.MATCH,
      `${card} accepted as ${idType}`,
      `idTypeScore=${r.idTypeScore} verdict=${r.verdict}`,
    );
  }

  // --- the case the whole feature exists for ------------------------------
  {
    const r = validate('philhealth', IdType.DRIVERS_LICENSE);
    const namesPhilHealth = r.detectedIdType === IdType.PHILHEALTH;
    report(
      r.idTypeMatch === false && namesPhilHealth,
      'PhilHealth REFUSED when Driver\'s License was selected',
      r.message,
    );
  }

  // --- other cross-card confusions ---------------------------------------
  {
    const r = validate('passport', IdType.DRIVERS_LICENSE);
    report(
      r.idTypeMatch === false,
      'passport refused when Driver\'s License was selected',
      `detected=${r.detectedIdType}`,
    );
  }
  {
    const r = validate('philsys', IdType.UMID);
    report(
      r.idTypeMatch === false,
      'PhilSys refused when UMID was selected',
      `detected=${r.detectedIdType}`,
    );
  }

  // --- Stage 1 still runs first ------------------------------------------
  {
    const r = validate('payslip', IdType.DRIVERS_LICENSE);
    report(
      r.typeMatch === false,
      'a payslip is stopped by Stage 1, before Stage 1b',
      `typeScore=${r.typeScore}`,
    );
  }

  // --- no subtype claimed means no subtype check --------------------------
  {
    const r = validateDocument({
      ocr: ocrOf(CARDS.philhealth, 'JUAN DELA CRUZ'),
      selectedType: DocType.VALID_ID,
      registeredName: NAME,
    });
    report(
      r.idTypeMatch === null || r.idTypeMatch === undefined,
      'without a claimed ID type, Stage 1b reports "not checked"',
      `idTypeMatch=${r.idTypeMatch}`,
    );
  }

  // --- front and back ------------------------------------------------------
  const LICENCE_BACK = `RESTRICTIONS 1 2
    CONDITIONS NONE
    ORGAN DONOR YES
    EMERGENCY CONTACT MARIA DELA CRUZ 09171234567
    ADDRESS 123 MABINI ST MAKATI CITY
    DL CODES A B`;

  {
    const r = validateDocument({
      ocr: ocrOf(CARDS.driversLicense, 'JUAN DELA CRUZ'),
      backOcr: ocrOf(LICENCE_BACK),
      selectedType: DocType.VALID_ID,
      selectedIdType: IdType.DRIVERS_LICENSE,
      registeredName: NAME,
    });
    report(
      r.backSideDistinct === true && r.idTypeMatch === true,
      'a genuine front and back are accepted as two sides',
      `backSideDistinct=${r.backSideDistinct}`,
    );
  }

  {
    // The common mistake: the front photographed twice.
    const r = validateDocument({
      ocr: ocrOf(CARDS.driversLicense, 'JUAN DELA CRUZ'),
      backOcr: ocrOf(CARDS.driversLicense),
      selectedType: DocType.VALID_ID,
      selectedIdType: IdType.DRIVERS_LICENSE,
      registeredName: NAME,
    });
    report(
      r.backSideDistinct === false,
      'the same side uploaded twice is detected',
      `backSideDistinct=${r.backSideDistinct}`,
    );
  }

  {
    const r = validate('driversLicense', IdType.DRIVERS_LICENSE);
    report(
      r.backSideDistinct === null || r.backSideDistinct === undefined,
      'with no back supplied, the side check reports "not applicable"',
      `backSideDistinct=${r.backSideDistinct}`,
    );
  }

  // --- captions must not be mistaken for values ---------------------------
  // The real layout of a Philippine driver's licence: the caption sits on its
  // own line and the value is printed underneath.
  {
    const LICENCE = `REPUBLIC OF THE PHILIPPINES
      DEPARTMENT OF TRANSPORTATION
      LAND TRANSPORTATION OFFICE
      DRIVER'S LICENSE
      Last Name. First Name. Middle Name
      PADILLA, JOSHUA ANDERSON RAYMUNDO
      Nationality Sex Date of Birth Weight (kg) Height(m)
      PHL M 2000/02/19 65 1.65
      Address
      634, TIBAGAN, SANTA ROSA II, MARILAO, BULACAN, 3019
      License No. Expiration Date Agency Code
      C70-25-004266 2030/02/19 C70`;

    const fields = extractFields(LICENCE);
    report(
      fields.fullName === 'PADILLA, JOSHUA ANDERSON RAYMUNDO',
      'the name is read from below the caption, not from the caption',
      `got "${fields.fullName}"`,
    );
    report(
      fields.idNumber === 'C70-25-004266',
      'the licence number is read, not "Expiration Date"',
      `got "${fields.idNumber}"`,
    );

    // Surname-first on the card, given-name-first on the account.
    const r = validateDocument({
      ocr: ocrOf(LICENCE, fields.fullName),
      selectedType: DocType.VALID_ID,
      selectedIdType: IdType.DRIVERS_LICENSE,
      registeredName: 'Joshua Anderson Raymundo Padilla',
    });
    report(
      r.verdict === Verdict.MATCH,
      'surname-first on the card still matches the registered name',
      `${(r.nameSimilarity * 100).toFixed(1)}%`,
    );
  }

  // --- short keywords must not be trusted ---------------------------------
  {
    // "PRINTING" contains "TIN"; if short needles were scored this would
    // register as a TIN ID and could outrank the real card.
    const scores = scoreIdType('COMMERCIAL PRINTING SERVICES INVOICE');
    const tin = scores.find((s) => s.idType === IdType.TIN_ID);
    report(
      (tin?.score ?? 0) === 0,
      'short substrings like TIN inside PRINTING score nothing',
      `tinScore=${tin?.score}`,
    );
  }

  console.log(
    failures === 0
      ? '\nAll checks passed.\n'
      : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
