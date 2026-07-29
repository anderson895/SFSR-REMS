import { useCallback, useState } from 'react';
import type { DocType, IdType } from '../constants';
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
export interface AnalysisInput {
  /** Front of the document — the side every check reads. */
  file: File;
  /** Reverse side, for IDs that carry data there. Optional. */
  backFile?: File | null;
  docType: DocType;
  /** Which specific government ID, when docType is Valid ID. */
  idType?: IdType | null;
  registeredName: string;
}

export type AnalysisOutput = {
  ocr: OcrResult;
  backOcr: OcrResult | null;
  validation: ValidationResult;
};

export function useDocumentAnalysis() {
  const [state, setState] = useState<AnalysisState>(IDLE);

  /**
   * Reads and validates a file without writing anything.
   *
   * Split out from `analyze` so a caller can find out whether a document is
   * acceptable *before* committing to it. The reservation flow needs exactly
   * that: it checks the buyer's ID first and only places the unit on hold once
   * the ID passes, so a wrong document never takes a unit off the market.
   *
   * Tesseract runs entirely in the browser, so this costs no upload and no
   * server round trip — the file never leaves the machine unless it passes.
   */
  const inspect = useCallback(
    async ({
      file,
      backFile,
      docType,
      idType,
      registeredName,
    }: AnalysisInput): Promise<AnalysisOutput | null> => {
      setState({ ...IDLE, running: true, phase: 'starting' });

      try {
        const track = (side: string) => (p: OcrProgress) =>
          setState((prev) => ({
            ...prev,
            phase: backFile ? `${side} — ${p.status}` : p.status,
            progress: p.progress,
          }));

        const ocr = await runOcr(file, track('front'));

        // The worker is shared and already warm by now, so the second pass
        // costs a fraction of the first.
        const backOcr = backFile
          ? await runOcr(backFile, track('back'))
          : null;

        const validation = validateDocument({
          ocr,
          backOcr,
          selectedType: docType,
          selectedIdType: idType,
          registeredName,
        });

        setState(IDLE);
        return { ocr, backOcr, validation };
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

  /** `inspect`, then persist the result against an existing document record. */
  const analyze = useCallback(
    async (
      documentId: string,
      input: AnalysisInput,
    ): Promise<AnalysisOutput | null> => {
      const result = await inspect(input);
      if (!result) return null;

      await saveDocumentAnalysis(
        documentId,
        result.ocr,
        result.validation,
        result.backOcr,
      );
      return result;
    },
    [inspect],
  );

  return { ...state, inspect, analyze };
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
