import { COLLECTIONS, type AuditLog, db, formatDateTime } from '@sfsr/shared';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';

const ALL = 'all';

const ACTION_LABELS: Record<string, string> = {
  'reservation.created': 'Reservation created',
  'reservation.approved': 'Reservation approved',
  'reservation.rejected': 'Reservation rejected',
  'reservation.cancelled': 'Reservation cancelled',
  'reservation.documents_requested': 'Additional documents requested',
  'document.uploaded': 'Document uploaded',
  'document.approved': 'Document approved',
  'document.rejected': 'Document rejected',
  'document.rescanned': 'Document re-scanned',
  'tripping.confirmed': 'Site visit confirmed',
  'tripping.completed': 'Site visit completed',
  'tripping.cancelled': 'Site visit cancelled',
  'unit.status_changed': 'Unit status changed',
  'user.created': 'User account created',
  'user.signed_in': 'User signed in',
};

/**
 * Read-only activity log.
 *
 * Entries are append-only at the rules layer — nothing in the application can
 * edit or delete one, which is what makes it usable as an audit trail rather
 * than just a list.
 */
/** Kept small on purpose — see the note on `load` below. */
const PAGE_SIZE = 50;

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [action, setAction] = useState(ALL);
  const [search, setSearch] = useState('');

  /**
   * Fetched once on demand rather than through a live listener.
   *
   * An audit trail is a historical record; nobody needs it to update as they
   * watch. A live `onSnapshot` here was the single most expensive thing in the
   * app: Firestore bills a read per document on every listener attach, so with
   * a 300-document window each hot reload during development cost 300 reads.
   * That is what pushed the project past its 50,000 free daily reads.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.AUDIT_LOGS),
          orderBy('at', 'desc'),
          limit(PAGE_SIZE),
        ),
      );
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog));
      setFetchedAt(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(
    () => [...new Set(logs.map((l) => l.action))].sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (action !== ALL && log.action !== action) return false;
      if (!needle) return true;
      return (
        log.actorName?.toLowerCase().includes(needle) ||
        log.targetId?.toLowerCase().includes(needle)
      );
    });
  }, [logs, action, search]);

  if (loading) return <p className="loading">Loading audit trail…</p>;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>Audit trail</h1>
          <p>
            Most recent {logs.length} activities. Records cannot be edited.
            {fetchedAt && <> &middot; loaded {formatDateTime(fetchedAt)}</>}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error && <p className="field-error">Could not load activity — {error}</p>}

      <div className="filters">
        <input
          type="search"
          placeholder="Search by user or record id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value={ALL}>All activity</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a] ?? a}
            </option>
          ))}
        </select>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>When</th>
            <th>User</th>
            <th>Activity</th>
            <th>Record</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty">
                No activity recorded yet.
              </td>
            </tr>
          ) : (
            filtered.map((log) => (
              <tr key={log.id}>
                <td className="nowrap">{formatDateTime(log.at)}</td>
                <td>{log.actorName || log.actorUid}</td>
                <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                <td>
                  <span className="cell-sub">
                    {log.targetType}/{log.targetId?.slice(0, 8)}
                  </span>
                </td>
                <td>
                  {log.meta ? (
                    <span className="cell-sub">
                      {Object.entries(log.meta)
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join(' · ')}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
