/**
 * Dumps the text of a PDF, optionally only the pages matching a pattern.
 *
 *   node scripts/readPdf.mjs <file.pdf> [regex]
 *
 * The repo's specification lives in PDFs, and the code has to agree with them.
 * `pdftoppm` is not installed here, so this uses the pdfjs-dist already vendored
 * for the portal's PDF-upload support rather than adding another dependency.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// pdfjs-dist is a dependency of SFSR-Shared, not of the repo root.
const require = createRequire(resolve('SFSR-Shared/package.json'));
const pdfjsPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
const { getDocument } = await import(`file:///${pdfjsPath.replace(/\\/g, '/')}`);

const [file, pattern] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/readPdf.mjs <file.pdf> [regex]');
  process.exit(1);
}

const filter = pattern ? new RegExp(pattern, 'i') : null;

const doc = await getDocument({
  data: new Uint8Array(readFileSync(file)),
  useSystemFonts: false,
}).promise;

console.log(`pages: ${doc.numPages}`);

for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  const text = content.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();

  if (!text) continue;
  if (filter && !filter.test(text)) continue;

  console.log(`\n=== page ${n} ===`);
  console.log(text);
}
