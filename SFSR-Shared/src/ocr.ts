/**
 * Optical Character Recognition via Tesseract.js.
 *
 * Tesseract.js runs entirely in the browser, so no OCR server and no paid API
 * is needed — the Internal Management System keeps working on the office LAN
 * with no internet connection. Recognition quality therefore depends on the
 * quality of the uploaded scan, exactly as noted in the study's limitations.
 */

import { createWorker, type Worker } from 'tesseract.js';
import type { OcrResult } from './types';

export interface OcrProgress {
  /** Tesseract's current phase, e.g. "recognizing text". */
  status: string;
  /** 0..1 */
  progress: number;
}

let workerPromise: Promise<Worker> | null = null;

/**
 * Lazily creates one shared Tesseract worker and reuses it.
 *
 * Spinning up a worker downloads and compiles the ~10 MB English model, which
 * takes several seconds. Creating one per document would make every upload
 * feel broken, so the cost is paid once per browser session.
 *
 * Tesseract.js already runs recognition off the main thread in its own Web
 * Worker, so the UI stays responsive while a page is being read.
 */
async function getWorker(onProgress?: (p: OcrProgress) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger: (m: { status: string; progress: number }) => {
        onProgress?.({ status: m.status, progress: m.progress });
      },
    });
  }
  return workerPromise;
}

/** Releases the shared worker. Call on sign-out to free memory. */
export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}

/**
 * Renders the first page of a PDF to a canvas.
 *
 * Tesseract cannot read PDFs directly — it only accepts images. Since the
 * study explicitly accepts PDF uploads, PDFs are rasterised here first. Page 1
 * is sufficient: the identifying heading and the buyer's name appear there on
 * every document type we validate.
 *
 * Rendered at 2x scale because OCR accuracy falls off sharply below roughly
 * 150 DPI, and the default PDF viewport is around 72 DPI.
 */
async function renderPdfFirstPage(file: File): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist');
  // Vite resolves this to a hashed asset URL and bundles the worker properly.
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url'))
    .default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create a canvas for the PDF.');

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

/** Pulls likely field values out of raw OCR text using layout-agnostic regexes. */
function extractFields(rawText: string): OcrResult['extracted'] {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const extracted: OcrResult['extracted'] = {};

  // A labelled name field, if the document has one.
  for (const line of lines) {
    const match = line.match(
      /\b(?:NAME|PANGALAN|FULL NAME|REGISTERED OWNER|RECEIVED FROM)\b\s*[:\-]?\s*(.{3,60})/i,
    );
    if (match?.[1]) {
      extracted.fullName = match[1].trim();
      break;
    }
  }

  // Fallback: the longest all-caps line is almost always the name on an ID.
  if (!extracted.fullName) {
    const capsLines = lines.filter(
      (l) => /^[A-Z\s.,'-]{6,60}$/.test(l) && /[A-Z]{2,}/.test(l),
    );
    if (capsLines.length) {
      extracted.fullName = capsLines.sort((a, b) => b.length - a.length)[0];
    }
  }

  const idMatch = rawText.match(
    /\b(?:ID|CRN|LICENSE|LIC|ACCOUNT|ACCT|REFERENCE|REF|REGISTRY|OR)\.?\s*(?:NO|NUMBER|#)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\s]{3,24})/i,
  );
  if (idMatch?.[1]) extracted.idNumber = idMatch[1].trim();

  // Common Philippine date shapes: 01/02/2024, 2024-01-02, January 2, 2024.
  const dateMatch = rawText.match(
    /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s+\d{1,2},?\s+\d{4})\b/i,
  );
  if (dateMatch?.[1]) extracted.date = dateMatch[1].trim();

  const addressMatch = rawText.match(
    /\b(?:ADDRESS|TIRAHAN|SERVICE ADDRESS|RESIDENCE)\b\s*[:\-]?\s*(.{5,100})/i,
  );
  if (addressMatch?.[1]) extracted.address = addressMatch[1].trim();

  return extracted;
}

/**
 * Runs OCR over an uploaded image or PDF and returns the raw text plus the
 * fields the study requires (full name, document number, date, address).
 */
export async function runOcr(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const worker = await getWorker(onProgress);

  const input: File | HTMLCanvasElement =
    file.type === 'application/pdf' ? await renderPdfFirstPage(file) : file;

  const { data } = await worker.recognize(input);
  const rawText = data.text ?? '';

  return {
    rawText,
    extracted: extractFields(rawText),
    engine: 'tesseract.js',
    meanConfidence: data.confidence ?? 0,
    processedAt: new Date().toISOString(),
  };
}
