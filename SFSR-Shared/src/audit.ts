/**
 * Audit trail writer.
 *
 * Every consequential action in the Internal Management System — approvals,
 * rejections, status changes — is recorded here so the company retains an
 * accountability record, as required by the study.
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS, db } from './firebase';
import type { AuditLog } from './types';

export type AuditAction =
  | 'reservation.created'
  | 'reservation.approved'
  | 'reservation.rejected'
  | 'reservation.cancelled'
  | 'reservation.documents_requested'
  | 'document.uploaded'
  | 'document.approved'
  | 'document.rejected'
  | 'document.rescanned'
  | 'unit.status_changed'
  | 'user.created'
  | 'user.signed_in';

export interface AuditEntry {
  actorUid: string;
  actorName: string;
  action: AuditAction;
  targetType: AuditLog['targetType'];
  targetId: string;
  meta?: Record<string, unknown>;
}

/**
 * Appends an audit entry.
 *
 * Deliberately never throws: an audit write failing must not roll back or block
 * the business action the user just completed. Failures are logged to the
 * console instead.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      ...entry,
      at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to write audit log', entry.action, error);
  }
}
