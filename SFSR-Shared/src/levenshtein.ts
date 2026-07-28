/**
 * Levenshtein Distance — the validation algorithm at the centre of this study.
 *
 * The distance between two strings is the minimum number of single-character
 * insertions, deletions, or substitutions needed to turn one into the other.
 * It is used here to tolerate small OCR misreadings so that a document is not
 * rejected over a single mangled character.
 */

import { SIMILARITY_MATCH, SIMILARITY_REVIEW, Verdict } from './constants';

/**
 * Normalises text before comparison so that formatting noise does not inflate
 * the distance. Without this, "Dela Cruz, Juan" vs "JUAN DELA CRUZ" would score
 * as wildly different despite naming the same person.
 *
 * - Unicode NFD + diacritic stripping, so "PEÑA" and "PENA" agree
 * - uppercase, so case never counts as an edit
 * - punctuation to spaces, then whitespace collapsed
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein distance with the two-row rolling variant.
 *
 * The classic algorithm fills an (m+1) x (n+1) matrix, but each row only ever
 * reads the row directly above it, so we keep just two rows. That drops memory
 * from O(m*n) to O(n) — worth doing here because OCR of a full page can produce
 * strings thousands of characters long.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Index the shorter string along the row to keep the arrays small.
  if (a.length > b.length) [a, b] = [b, a];

  let previous = new Array<number>(a.length + 1);
  let current = new Array<number>(a.length + 1);

  for (let i = 0; i <= a.length; i++) previous[i] = i;

  for (let j = 1; j <= b.length; j++) {
    current[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[i] = Math.min(
        current[i - 1] + 1, // insertion
        previous[i] + 1, // deletion
        previous[i - 1] + substitutionCost, // substitution
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[a.length];
}

/**
 * Converts a raw distance into a 0..1 similarity ratio.
 *
 * Dividing by the longer length makes the score comparable across strings of
 * different sizes: 1 edit in a 4-character string is a far bigger deal than
 * 1 edit in a 40-character one.
 */
export function similarityRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshteinDistance(a, b) / longest;
}

export interface ComparisonResult {
  /** The two strings after normalisation, so the UI can show what was compared. */
  normalizedA: string;
  normalizedB: string;
  distance: number;
  /** 0..1, where 1 is an exact match. */
  similarity: number;
  verdict: Verdict;
}

/**
 * Normalises both inputs, compares them, and grades the result.
 *
 * Note that a MATCH verdict is a recommendation only. Per the manuscript's
 * limitations, final acceptance or rejection of a document always rests with
 * authorised personnel — the system is decision support, not an auto-approver.
 */
export function compareText(a: string, b: string): ComparisonResult {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  const distance = levenshteinDistance(normalizedA, normalizedB);
  const similarity = similarityRatio(normalizedA, normalizedB);

  let verdict: Verdict = Verdict.MISMATCH;
  if (similarity >= SIMILARITY_MATCH) verdict = Verdict.MATCH;
  else if (similarity >= SIMILARITY_REVIEW) verdict = Verdict.REVIEW;

  return { normalizedA, normalizedB, distance, similarity, verdict };
}

/**
 * Compares two names token by token, ignoring word order.
 *
 * Philippine identity documents print names surname-first — "DELA CRUZ, JUAN
 * SANTOS" — while the buyer registers as "Juan Dela Cruz". Comparing those two
 * as flat strings scores about 64%, which would wrongly reject a perfectly
 * valid ID. Matching each registered name part against its best counterpart
 * makes the comparison order-independent, and tolerates the extra middle name
 * that IDs carry but registration forms often omit.
 *
 * Each part is weighted by its length so that a mangled "CRUZ" counts for more
 * than a mangled middle initial.
 */
export function tokenAlignedComparison(
  needle: string,
  candidate: string,
): ComparisonResult {
  const normalizedA = normalizeText(needle);
  const normalizedB = normalizeText(candidate);

  const needleTokens = normalizedA.split(' ').filter(Boolean);
  const candidateTokens = normalizedB.split(' ').filter(Boolean);

  if (!needleTokens.length || !candidateTokens.length) {
    return compareText(needle, candidate);
  }

  const used = new Set<number>();
  const aligned: string[] = [];
  let weightedScore = 0;
  let totalWeight = 0;

  for (const token of needleTokens) {
    let bestIndex = -1;
    let bestScore = 0;

    candidateTokens.forEach((candidateToken, index) => {
      if (used.has(index)) return;
      const score = similarityRatio(token, candidateToken);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0) {
      used.add(bestIndex);
      aligned.push(candidateTokens[bestIndex]);
    }

    weightedScore += bestScore * token.length;
    totalWeight += token.length;
  }

  const similarity = totalWeight ? weightedScore / totalWeight : 0;
  // Report the distance against the candidate re-ordered to match the
  // registered name, so the "character difference" shown to staff lines up
  // with the similarity percentage beside it.
  const distance = levenshteinDistance(normalizedA, aligned.join(' '));

  let verdict: Verdict = Verdict.MISMATCH;
  if (similarity >= SIMILARITY_MATCH) verdict = Verdict.MATCH;
  else if (similarity >= SIMILARITY_REVIEW) verdict = Verdict.REVIEW;

  return {
    normalizedA,
    normalizedB: aligned.join(' '),
    distance,
    similarity,
    verdict,
  };
}

/**
 * Locates the buyer's name inside a full page of OCR text.
 *
 * OCR returns the entire document, not an isolated field, so comparing a
 * 14-character name against 2,000 characters of page text would always score
 * near zero. Instead we slide a window of roughly the name's word count across
 * the page and keep the best hit, scoring each window with
 * `tokenAlignedComparison`.
 *
 * Windows are kept contiguous rather than matching tokens anywhere on the page:
 * a document that merely happens to contain the words "JUAN" and "CRUZ" in
 * unrelated places should not pass validation — the name has to actually appear
 * together.
 */
export function bestWindowSimilarity(
  needle: string,
  haystack: string,
): ComparisonResult {
  const normalizedNeedle = normalizeText(needle);
  const normalizedHaystack = normalizeText(haystack);

  if (!normalizedNeedle || !normalizedHaystack) {
    return compareText(needle, haystack);
  }

  const words = normalizedHaystack.split(' ').filter(Boolean);
  const needleWordCount = normalizedNeedle.split(' ').filter(Boolean).length;

  let best: ComparisonResult | null = null;

  // Spans run from one word short (missing middle name) to two words long
  // (extra middle name or suffix such as JR).
  const minSpan = Math.max(1, needleWordCount - 1);
  const maxSpan = needleWordCount + 2;

  for (let span = minSpan; span <= maxSpan; span++) {
    for (let start = 0; start + span <= words.length; start++) {
      const candidate = words.slice(start, start + span).join(' ');
      const result = tokenAlignedComparison(normalizedNeedle, candidate);
      if (!best || result.similarity > best.similarity) best = result;
    }
  }

  return best ?? compareText(needle, haystack);
}
