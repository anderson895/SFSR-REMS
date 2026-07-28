/**
 * Standalone sanity check for the validation algorithms.
 *
 * Run with:  npx tsx scripts/checkAlgorithms.ts
 *
 * Exercises the two cores without a browser, a Firebase connection, or any UI,
 * so an algorithm bug surfaces here rather than three layers deep in React.
 * Includes the exact worked example from the manuscript.
 */

import { DocType } from '../SFSR-Shared/src/constants';
import { scoreDocumentType } from '../SFSR-Shared/src/docPatterns';
import {
  bestWindowSimilarity,
  compareText,
  levenshteinDistance,
  normalizeText,
} from '../SFSR-Shared/src/levenshtein';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${label}`);
  if (!pass) console.log(`         expected ${expected}, got ${actual}`);
}

console.log('\nLevenshtein distance');
check('identical strings', levenshteinDistance('CRUZ', 'CRUZ'), 0);
check('one substitution', levenshteinDistance('CRUZ', 'CRVZ'), 1);
check('one deletion', levenshteinDistance('CRUZ', 'CRZ'), 1);
check('empty vs word', levenshteinDistance('', 'CRUZ'), 4);
check('classic kitten/sitting', levenshteinDistance('kitten', 'sitting'), 3);

console.log('\nNormalisation');
check('case and punctuation', normalizeText('Dela Cruz, Juan.'), 'DELA CRUZ JUAN');
check('diacritics stripped', normalizeText('Peña'), 'PENA');
check('whitespace collapsed', normalizeText('  JUAN   CRUZ  '), 'JUAN CRUZ');

console.log("\nManuscript's worked example: JUAN DELA CRVZ vs JUAN DELA CRUZ");
const worked = compareText('JUAN DELA CRUZ', 'JUAN DELA CRVZ');
console.log(
  `  distance=${worked.distance}  similarity=${(worked.similarity * 100).toFixed(1)}%  verdict=${worked.verdict}`,
);
check('distance is 1', worked.distance, 1);
check('verdict is match', worked.verdict, 'match');

console.log('\nName found inside a full page of OCR text');
const pageText = `
  REPUBLIC OF THE PHILIPPINES
  DEPARTMENT OF TRANSPORTATION
  DRIVER'S LICENSE
  Last Name, First Name, Middle Name
  DELA CRVZ, JUAN SANTOS
  Nationality PHL   Sex M   Date of Birth 1995/04/12
  License No. N01-23-456789
`;
const windowed = bestWindowSimilarity('JUAN DELA CRUZ', pageText);
console.log(
  `  best window="${windowed.normalizedB}"  similarity=${(windowed.similarity * 100).toFixed(1)}%  verdict=${windowed.verdict}`,
);
check('finds the name despite OCR noise', windowed.verdict !== 'mismatch', true);

// Guards against the token-aligned comparison being so permissive that any
// name passes. A different person's ID must still be rejected.
const wrongPerson = bestWindowSimilarity('MARIA REYES SANTOS', pageText);
console.log(
  `  wrong person best window="${wrongPerson.normalizedB}" similarity=${(wrongPerson.similarity * 100).toFixed(1)}%  verdict=${wrongPerson.verdict}`,
);
check('rejects a different person', wrongPerson.verdict, 'mismatch');

console.log('\nStage 1 document type detection');
const idScores = scoreDocumentType(pageText);
console.log(
  `  top match: ${idScores[0].docType} (score ${idScores[0].score}) via ${idScores[0].matchedKeywords.slice(0, 3).join(', ')}`,
);
check('detects a valid ID', idScores[0].docType, DocType.VALID_ID);

const billText = `
  MERALCO
  STATEMENT OF ACCOUNT
  Service Address: 123 Bonifacio St, Mandaluyong City
  Billing Period: Jan 01 - Jan 31, 2024
  Amount Due: PHP 3,412.50   Due Date: 02/15/2024
`;
const billScores = scoreDocumentType(billText);
console.log(
  `  top match: ${billScores[0].docType} (score ${billScores[0].score})`,
);
check('detects proof of billing', billScores[0].docType, DocType.PROOF_OF_BILLING);

console.log(
  failures === 0
    ? '\nAll checks passed.\n'
    : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
