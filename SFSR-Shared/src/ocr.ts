/**
 * Optical Character Recognition via Tesseract.js.
 *
 * Tesseract.js runs entirely in the browser, so no OCR server and no paid API
 * is needed — the Internal Management System keeps working on the office LAN
 * with no internet connection. Recognition quality therefore depends on the
 * quality of the uploaded scan, exactly as noted in the study's limitations.
 */

import { extractFields } from './extractFields';
import type { Worker } from 'tesseract.js';
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
    // Imported dynamically, not at the top of the file, for two reasons.
    //
    // Tesseract.js and its ~10 MB English model are only needed once someone
    // actually scans a document, so eager loading would slow every page.
    //
    // More importantly it contains the blast radius: a top-level import means
    // any failure loading this library takes down the entire application at
    // startup with a blank page, instead of failing just the OCR feature.
    const { createWorker } = await import('tesseract.js');

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