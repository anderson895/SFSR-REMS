import {
  type TrippingRequest,
  TrippingStatus,
  fullNameOf,
  setTrippingStatus,
  useTrippingRequests,
  writeAuditLog,
} from '@sfsr/shared';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePromptDialog } from '../components/PromptDialog';

const FILTERS: { label: string; value: TrippingStatus | 'all' }[] = [
  { label: 'Pending', value: TrippingStatus.PENDING },
  { label: 'Confirmed', value: TrippingStatus.CONFIRMED },
  { label: 'Completed', value: TrippingStatus.COMPLETED },
  { label: 'Cancelled', value: TrippingStatus.CANCELLED },
  { label: 'All', value: 'all' },
];

/**
 * Site-visit requests filed from the public portal.
 *
 * Defaults to Pending because that is the only list with work in it — a
 * request nobody has answered is a lead going cold.
 */
export default function TrippingPage() {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState<TrippingStatus | 'all'>(
    TrippingStatus.PENDING,
  );
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const { prompt, dialog } = usePromptDialog();

  const { requests, loading } = useTrippingRequests(
    filter === 'all' ? undefined : filter,
  );

  async function decide(
    request: TrippingRequest,
    status: Exclude<TrippingStatus, 'pending'>,
  ) {
    if (!user) return;

    let note = '';
    if (status === TrippingStatus.CANCELLED) {
      const reason = await prompt({
        title: `Cancel the site visit on ${request.preferredDate}?`,
        message: `${request.fullName} requested ${request.preferredSlot} at ${request.projectName}. Nothing is reserved by a site visit, so this only frees the slot.`,
        label: 'Reason (for your records)',
        confirmLabel: 'Cancel site visit',
        destructive: true,
      });
      if (reason === null) return;
      note = reason;
    }

    setError('');
    setBusyId(request.id);
    try {
      await setTrippingStatus(request.id, status, user.uid, note);
      await writeAuditLog({
        actorUid: user.uid,
        actorName: profile ? fullNameOf(profile) : 'staff',
        action: `tripping.${status}`,
        targetType: 'tripping',
        targetId: request.id,
        meta: { projectName: request.projectName, date: request.preferredDate },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="stack">
      {dialog}
      <div className="page-head">
        <h1>Site visit requests</h1>
        <p>Tripping bookings submitted through the public portal.</p>
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="tab-row">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`tab${filter === f.value ? ' is-active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading">Loading requests…</p>
      ) : requests.length === 0 ? (
        <div className="notice">
          <h2>Nothing here</h2>
          <p>No {filter === 'all' ? '' : filter} site visit requests.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Requested for</th>
              <th>Project</th>
              <th>Visitor</th>
              <th>Contact</th>
              <th>Party</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.preferredDate}</strong>
                  <p className="cell-sub">{r.preferredSlot}</p>
                </td>
                <td>{r.projectName}</td>
                <td>
                  {r.fullName}
                  {r.message && <p className="cell-sub">“{r.message}”</p>}
                </td>
                <td>
                  {r.mobile}
                  <p className="cell-sub">{r.email}</p>
                </td>
                <td>{r.partySize}</td>
                <td>
                  <span className={`status-pill status-res-${r.status}`}>
                    {r.status}
                  </span>
                  {r.staffNote && <p className="cell-sub">{r.staffNote}</p>}
                </td>
                <td className="row-actions">
                  {r.status === TrippingStatus.PENDING && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyId === r.id}
                      onClick={() => void decide(r, TrippingStatus.CONFIRMED)}
                    >
                      Confirm
                    </button>
                  )}
                  {r.status === TrippingStatus.CONFIRMED && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busyId === r.id}
                      onClick={() => void decide(r, TrippingStatus.COMPLETED)}
                    >
                      Mark visited
                    </button>
                  )}
                  {(r.status === TrippingStatus.PENDING ||
                    r.status === TrippingStatus.CONFIRMED) && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busyId === r.id}
                      onClick={() => void decide(r, TrippingStatus.CANCELLED)}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
