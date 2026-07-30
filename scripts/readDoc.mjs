/**
 * Dumps readable text from a legacy Word .doc.
 *
 *   node scripts/readDoc.mjs documentation/DATABASE.doc
 *   node scripts/readDoc.mjs documentation/DATABASE.doc "1904|On Hold"
 *
 * Kept alongside readPdf.mjs because documentation/conflict.txt cites both
 * DATABASE.doc and the PDFs throughout, and a claim about a specification is
 * only useful if the next reader can check it.
 *
 * .doc is a binary OLE format whose body is stored as UTF-16LE runs; pulling
 * the printable sequences out is enough to read the text without adding a
 * parser dependency. Opens read-only with shared access, so it works while the
 * file is still open in Word.
 */

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

const [file, pattern] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/readDoc.mjs <file.doc> [regex]');
  process.exit(1);
}

const fd = openSync(file, 'r');
const size = fstatSync(fd).size;
const buffer = Buffer.alloc(size);
readSync(fd, buffer, 0, size, 0);
closeSync(fd);

const text = buffer
  .toString('utf16le')
  .match(/[\x20-\x7E]{4,}/g)
  ?.join(' ')
  .replace(/\s+/g, ' ')
  .trim();

if (!text) {
  console.error('No readable text found.');
  process.exit(1);
}

if (!pattern) {
  console.log(text);
} else {
  const matches = text.match(new RegExp(`.{0,300}(?:${pattern}).{0,400}`, 'gi'));
  if (!matches) {
    console.log(`no match for /${pattern}/`);
  } else {
    matches.forEach((m, i) => console.log(`\n=== hit ${i + 1} ===\n${m}`));
  }
}
