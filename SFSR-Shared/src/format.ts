/**
 * Display formatting shared by both applications.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Anything a date might arrive as.
 *
 * Firestore timestamps for server-written fields, and plain ISO strings for the
 * dates a person typed — a payment date, the moment consent was given. Both end
 * up in the same tables, so both are accepted here rather than making every
 * caller remember which is which.
 */
type MaybeTimestamp =
  | Timestamp
  | { seconds: number }
  | Date
  | string
  | null
  | undefined;

function toDate(value: MaybeTimestamp): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  if (typeof (value as { seconds: number }).seconds === 'number') {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

/**
 * Date and time, e.g. "29 Jul 2026, 9:41 AM".
 *
 * Returns a dash rather than throwing when the value is missing. A field
 * written with `serverTimestamp()` reads back as null in the writer's own
 * snapshot for a moment before the server confirms it, so a freshly created
 * reservation would otherwise crash the row that is displaying it.
 */
export function formatDateTime(value: MaybeTimestamp): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Date only, e.g. "29 Jul 2026". */
export function formatDate(value: MaybeTimestamp): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Time only, e.g. "9:41 AM". */
export function formatTime(value: MaybeTimestamp): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
