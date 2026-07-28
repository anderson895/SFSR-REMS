import { useCallback, useState } from 'react';
import type { DocType } from '../constants';
import { saveDocumentAnalysis } from '../documents';
import { type OcrProgress, runOcr } from '../ocr';
import type { OcrResult, ValidationResult } from '../types';
import { validateDocument } from '../validateDocument';

export interface AnalysisState {
  running: boolean;
  /** Tesseract's current phase, e.g. "recognizing text". */
  phase: string;
  /** 0..1 */
  progress: number;
  error: string;
}

const IDLE: AnalysisState = {
  running: false,
  phase: '',
  progress: 0,
  error: '',
};

/**
 * Runs the full validation pipeline for one document and persists the result.
 *
 *   OCR  ->  Stage 1 document type check  ->  Stage 2 Levenshtein name match
 *
 * Reports progress so the caller can show a bar; the first run in a browser
 * session is noticeably slower because Tesseract has to fetch and compile its
 * English model before it can read anything.
 */
export function useDocumentAnalysis() {
  const [state, setState] = useState<AnalysisState>(IDLE);

  const analyze = useCallback(
    async (
      documentId: string,
      file: File,
      docType: DocType,
      registeredName: string,
    ): Promise<{ ocr: OcrResult; validation: ValidationResult } | null> => {
      setState({ ...IDLE, running: true, phase: 'starting' });

      try {
        const ocr = await runOcr(file, (p: OcrProgress) =>
          setState((prev) => ({
            ...prev,
            phase: p.status,
            progress: p.progress,
          })),
        );

        const validation = validateDocument({
          ocr,
          selectedType: docType,
          registeredName,
        });

        await saveDocumentAnalysis(documentId, ocr, validation);

        setState(IDLE);
        return { ocr, validation };
      } catch (error) {
        setState({
          ...IDLE,
          error:
            (error as Error).message ??
            'Could not read this document. Try a clearer scan.',
        });
        return null;
      }
    },
    [],
  );

  return { ...state, analyze };
}

/**
 * Re-downloads a previously uploaded file so it can be scanned again.
 *
 * Staff need this to re-run OCR on a document the buyer uploaded from their own
 * device — the original File object only ever existed in the buyer's browser.
 */
export async function fetchStoredFile(
  url: string,
  mimeType: string,
): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download the stored file (${response.status}).`);
  }
  const blob = await response.blob();
  const name = url.split('/').pop() ?? 'document';
  return new File([blob], name, { type: mimeType || blob.type });
}
