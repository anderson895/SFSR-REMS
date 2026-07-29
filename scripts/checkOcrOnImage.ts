/**
 * Runs the real OCR pipeline over a real photo of an ID.
 *
 *   npx tsx scripts/checkOcrOnImage.ts <front.jpg> [back.jpg] "Registered Name"
 *
 * The fixture tests in `checkIdValidation.ts` use hand-written OCR text, which
 * proves the scoring logic but cannot catch a field extractor that reads a
 * caption instead of a value — the text has to come out of Tesseract for that.
 * This runs the same `extractFields` and `validateDocument` the browser does,
 * against an actual photograph.
 */

import { readFileSync } from 'node:fs';
import { createWorker } from 'tesseract.js';
import { DocType, IdType } from '../SFSR-Shared/src/constants';
// The real extractor, not a copy. It lives outside ocr.ts precisely so this
// script can exercise the same code the browser runs.
import { extractFields } from '../SFSR-Shared/src/extractFields';
import type { OcrResult } from '../SFSR-Shared/src/types';
import { validateDocument } from '../SFSR-Shared/src/validateDocument';

const [frontPath, secondArg, thirdArg] = process.argv.slice(2);

if (!frontPath) {
  console.error(
    'Usage: npx tsx scripts/checkOcrOnImage.ts <front> [back] "Registered Name"',
  );
  process.exit(1);
}

// The back is optional, so the last argument is the name either way.
const backPath = thirdArg ? secondArg : undefined;
const registeredName = thirdArg ?? secondArg ?? '';

async function main() {
  const worker = await createWorker('eng');

  async function read(path: string): Promise<OcrResult> {
    const { data } = await worker.recognize(readFileSync(path));
    const rawText = data.text ?? '';
    return {
      rawText,
      extracted: extractFields(rawText),
      engine: 'tesseract.js',
      meanConfidence: data.confidence ?? 0,
      processedAt: new Date().toISOString(),
    };
  }

  console.log(`\nReading ${frontPath}…`);
  const front = await read(frontPath);

  const back = backPath ? await read(backPath) : null;
  if (backPath) console.log(`Reading ${backPath}…`);

  await worker.terminate();

  console.log('\n--- extracted from the front ---');
  console.log('  fullName :', front.extracted.fullName ?? '(none)');
  console.log('  idNumber :', front.extracted.idNumber ?? '(none)');
  console.log('  confidence:', front.meanConfidence.toFixed(0) + '%');

  const validation = validateDocument({
    ocr: front,
    backOcr: back,
    selectedType: DocType.VALID_ID,
    selectedIdType: IdType.DRIVERS_LICENSE,
    registeredName,
  });

  console.log('\n--- validation ---');
  console.log('  Stage 1  typeMatch      :', validation.typeMatch);
  console.log('  Stage 1b idTypeMatch    :', validation.idTypeMatch);
  console.log('  Both sides distinct     :', validation.backSideDistinct);
  console.log('  Stage 2  similarity     :', (validation.nameSimilarity * 100).toFixed(1) + '%');
  console.log('  Stage 2  distance       :', validation.nameDistance);
  console.log('  compared against        :', validation.comparedAgainst);
  console.log('  matched text            :', validation.matchedText);
  console.log('  verdict                 :', validation.verdict);
  console.log('\n  ' + validation.message + '\n');

  process.exit(0);
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
