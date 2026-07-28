/**
 * Reservation creation and approval.
 *
 * These are the operations that must never race. Two buyers clicking "Reserve"
 * on the same unit at the same moment, or a walk-in reservation being written
 * while an online one is in flight, must result in exactly one hold.
 *
 * Every unit status change therefore goes through a Firestore transaction. A
 * plain read-then-write would let both callers read "available" before either
 * writes, and the company would double-sell the unit — precisely the problem
 * the study sets out to eliminate.
 */

import {
  type DocumentReference,
  type Transaction,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  AccountType,
  ReservationSource,
  ReservationStatus,
  UnitStatus,
} from './constants';
import { COLLECTIONS, db } from './firebase';
import type { BuyerSnapshot, Unit } from './types';

/** Thrown when the unit was taken between page load and submission. */
export class UnitUnavailableError extends Error {
  constructor(public readonly status: UnitStatus | 'missing') {
    super(
      status === 'missing'
        ? 'That unit no longer exists.'
        : `That unit is no longer available (current status: ${status}).`,
    );
    this.name = 'UnitUnavailableError';
  }
}

export interface CreateReservationInput {
  unitId: string;
  buyer: BuyerSnapshot;
  /** Null for a walk-in buyer with no portal account. */
  buyerUid: string | null;
  source: ReservationSource;
  /** UID of whoever is performing the action (the buyer, or staff). */
  createdBy: string;
  remarks?: string;
}

/**
 * Atomically places a unit On Hold and creates the reservation.
 *
 * Both writes land in a single commit: either the unit is held and the
 * reservation exists, or neither happened. Firestore retries the callback
 * automatically if another client touched the unit mid-transaction, so the
 * loser of a race re-reads the unit, sees `on_hold`, and gets a clean error.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<string> {
  const unitRef = doc(db, COLLECTIONS.UNITS, input.unitId);
  const reservationRef = doc(collection(db, COLLECTIONS.RESERVATIONS));

  try {
    await runTransaction(db, async (tx: Transaction) => {
      const unitSnap = await tx.get(unitRef);
      if (!unitSnap.exists()) throw new UnitUnavailableError('missing');

      const unit = unitSnap.data() as Unit;
      // The guard that makes double-selling impossible.
      if (unit.status !== UnitStatus.AVAILABLE) {
        throw new UnitUnavailableError(unit.status);
      }

      tx.update(unitRef, {
        status: UnitStatus.ON_HOLD,
        heldBy: reservationRef.id,
        updatedAt: serverTimestamp(),
      });

      tx.set(reservationRef, {
        unitId: input.unitId,
        unitLabel: `${unit.building} - Unit ${unit.unitNo}`,
        buyerUid: input.buyerUid,
        buyer: input.buyer,
        source: input.source,
        status: ReservationStatus.PENDING,
        reservationDate: serverTimestamp(),
        createdBy: input.createdBy,
        createdAt: serverTimestamp(),
        remarks: input.remarks ?? '',
      });
    });
  } catch (error) {
    throw await translateHoldFailure(error, unitRef);
  }

  return reservationRef.id;
}

/**
 * Turns a rules rejection into the right error for the user.
 *
 * When two buyers reserve the same unit at the same instant, the loser can read
 * the unit while it is still `available`, pass the guard above, and only be
 * stopped at commit time by the `buyerPlacingHold()` rule — which requires the
 * stored status to still be `available`. Firestore reports that as
 * `permission-denied`, so without this the buyer would be shown
 * "Missing or insufficient permissions" for what is really just losing a race.
 *
 * The unit is re-read before deciding, so a genuine permissions problem — rules
 * not deployed, signed-out user — is still reported as itself rather than being
 * hidden behind a misleading "unavailable" message.
 */
async function translateHoldFailure(
  error: unknown,
  unitRef: DocumentReference,
): Promise<unknown> {
  if (error instanceof UnitUnavailableError) return error;
  if ((error as { code?: string })?.code !== 'permission-denied') return error;

  try {
    const snap = await getDoc(unitRef);
    if (!snap.exists()) return new UnitUnavailableError('missing');

    const status = (snap.data() as Unit).status;
    if (status !== UnitStatus.AVAILABLE) return new UnitUnavailableError(status);
  } catch {
    // Could not re-read; fall through and report the original error.
  }

  return error;
}

/**
 * Approves a reservation: unit On Hold -> Reserved, and the buyer's Initial
 * Account is converted to a Permanent Client Account.
 *
 * Also transactional, so a unit cannot be approved twice or approved after
 * being released by a concurrent cancellation.
 */
export async function approveReservation(
  reservationId: string,
  reviewerUid: string,
): Promise<void> {
  const reservationRef = doc(db, COLLECTIONS.RESERVATIONS, reservationId);

  await runTransaction(db, async (tx: Transaction) => {
    const reservationSnap = await tx.get(reservationRef);
    if (!reservationSnap.exists()) throw new Error('Reservation not found.');

    const reservation = reservationSnap.data();
    if (reservation.status === ReservationStatus.APPROVED) {
      throw new Error('This reservation has already been approved.');
    }

    const unitRef = doc(db, COLLECTIONS.UNITS, reservation.unitId);
    const unitSnap = await tx.get(unitRef);
    if (!unitSnap.exists()) throw new UnitUnavailableError('missing');

    const unit = unitSnap.data() as Unit;
    if (unit.heldBy !== reservationId) {
      throw new Error(
        'This unit is no longer held by this reservation. Refresh and try again.',
      );
    }

    tx.update(unitRef, {
      status: UnitStatus.RESERVED,
      updatedAt: serverTimestamp(),
    });

    tx.update(reservationRef, {
      status: ReservationStatus.APPROVED,
      reviewedBy: reviewerUid,
      reviewedAt: serverTimestamp(),
    });

    // Initial Account -> Permanent Client Account, unlocking the Client Portal.
    if (reservation.buyerUid) {
      tx.update(doc(db, COLLECTIONS.USERS, reservation.buyerUid), {
        accountType: AccountType.CLIENT,
      });
    }
  });
}

/**
 * Moves a reservation to Under Review and records what the buyer still needs to
 * submit.
 *
 * The unit keeps its hold: the buyer is being asked for more paperwork, not
 * turned down, so releasing the unit here would let someone else take it while
 * they are still complying.
 */
export async function requestAdditionalDocuments(
  reservationId: string,
  reviewerUid: string,
  message: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.RESERVATIONS, reservationId), {
    status: ReservationStatus.UNDER_REVIEW,
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    remarks: message,
  });
}

/**
 * Rejects a reservation and returns the unit to Available so it reappears on
 * the portal.
 */
export async function rejectReservation(
  reservationId: string,
  reviewerUid: string,
  reason: string,
): Promise<void> {
  const reservationRef = doc(db, COLLECTIONS.RESERVATIONS, reservationId);

  await runTransaction(db, async (tx: Transaction) => {
    const reservationSnap = await tx.get(reservationRef);
    if (!reservationSnap.exists()) throw new Error('Reservation not found.');

    const reservation = reservationSnap.data();
    const unitRef = doc(db, COLLECTIONS.UNITS, reservation.unitId);
    const unitSnap = await tx.get(unitRef);

    // Only release the unit if this reservation is the one holding it —
    // otherwise we would free a unit another reservation legitimately owns.
    if (unitSnap.exists() && unitSnap.data().heldBy === reservationId) {
      tx.update(unitRef, {
        status: UnitStatus.AVAILABLE,
        heldBy: null,
        updatedAt: serverTimestamp(),
      });
    }

    tx.update(reservationRef, {
      status: ReservationStatus.REJECTED,
      reviewedBy: reviewerUid,
      reviewedAt: serverTimestamp(),
      remarks: reason,
    });
  });
}
