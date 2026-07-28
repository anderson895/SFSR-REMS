import { useState } from 'react';
import { DOC_TYPE_LABELS, Verdict } from '../constants';
import type { DocumentRecord } from '../types';
import { verdictLabel } from '../validateDocument';

/**
 * Shows what OCR read and what the Levenshtein comparison concluded.
 *
 * The raw similarity score and edit distance are always displayed, never just a
 * pass/fail badge. Phase 1 requires the score to be visible, and more
 * importantly the reviewer needs to see *why* the system reached its verdict
 * before accepting or overriding it.
 */
export function ValidationPanel({ document }: { document: DocumentRecord }) {
  const [showRaw, setShowRaw] = useState(false);
  const { ocr, validation } = document;

  if (!ocr || !validation) {
    return (
      <p className="analysis-empty">
        Not yet scanned. Run OCR to validate this document.
      </p>
    );
  }

  const percent = (validation.nameSimilarity * 100).toFixed(1);

  return (
    <div className="analysis">
      <div className={`verdict verdict-${validation.verdict}`}>
        <strong>{verdictLabel(validation.verdict)}</strong>
        <span>{validation.message}</span>
      </div>

      <div className="analysis-grid">
        <div className="metric">
          <span className="metric-label">Stage 1 — Document type</span>
          <span className="metric-value">
            {validation.typeMatch ? 'Matches' : 'Does not match'}
          </span>
          <span className="metric-sub">
            {DOC_TYPE_LABELS[document.docType]} &middot; confidence{' '}
            {(validation.typeScore * 100).toFixed(0)}%
            {validation.detectedType && (
              <> &middot; looks like {DOC_TYPE_LABELS[validation.detectedType]}</>
            )}
          </span>
        </div>

        <div className="metric">
          <span className="metric-label">Stage 2 — Name similarity</span>
          <span className="metric-value">{percent}%</span>
          <span className="metric-sub">
            Levenshtein distance{' '}
            {validation.nameDistance < 0 ? '—' : validation.nameDistance}
            {' '}character(s)
          </span>
        </div>
      </div>

      {/* A visible bar makes the two thresholds concrete rather than abstract. */}
      <div className="similarity-track">
        <div
          className={`similarity-fill fill-${validation.verdict}`}
          style={{ width: `${Math.max(0, validation.nameSimilarity) * 100}%` }}
        />
        <span className="threshold threshold-review" title="Review threshold 70%" />
        <span className="threshold threshold-match" title="Match threshold 85%" />
      </div>
      <p className="threshold-legend">
        <span>0%</span>
        <span>70% review</span>
        <span>85% match</span>
        <span>100%</span>
      </p>

      <dl className="compare-list">
        <div>
          <dt>Registered name</dt>
          <dd>{validation.comparedAgainst || '—'}</dd>
        </div>
        <div>
          <dt>Name found on document</dt>
          <dd>{validation.matchedText || '—'}</dd>
        </div>
        <div>
          <dt>Document number</dt>
          <dd>{ocr.extracted.idNumber || '—'}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{ocr.extracted.date || '—'}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{ocr.extracted.address || '—'}</dd>
        </div>
        <div>
          <dt>OCR confidence</dt>
          <dd>{ocr.meanConfidence.toFixed(0)}%</dd>
        </div>
      </dl>

      <button
        type="button"
        className="btn btn-link"
        onClick={() => setShowRaw((v) => !v)}
      >
        {showRaw ? 'Hide' : 'Show'} raw OCR text
      </button>

      {showRaw && <pre className="raw-ocr">{ocr.rawText || '(no text read)'}</pre>}

      <p className="analysis-foot">
        Automated validation is decision support. Final acceptance or rejection
        remains with authorized personnel.
      </p>
    </div>
  );
}

export { Verdict };
