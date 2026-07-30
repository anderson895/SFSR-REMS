import {
  COLLECTIONS,
  Role,
  authErrorMessage,
  createStaffAccount,
  db,
  fullNameOf,
  type UserProfile,
  writeAuditLog,
} from '@sfsr/shared';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { type FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  department: '',
  role: Role.SALES as Exclude<Role, 'buyer'>,
};

/** Admin-only module for creating and listing employee accounts. */
export default function UserManagementPage() {
  const { user, profile } = useAuth();
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('role', 'in', [Role.SALES, Role.DOCUMENTATION, Role.ADMIN]),
      limit(200),
    );
    return onSnapshot(q, (snap) => {
      setStaff(
        snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile),
      );
    });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setStatus('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      const uid = await createStaffAccount(form);
      await writeAuditLog({
        actorUid: user?.uid ?? '',
        actorName: profile ? fullNameOf(profile) : 'unknown',
        action: 'user.created',
        targetType: 'user',
        targetId: uid,
        meta: { role: form.role, email: form.email },
      });
      setStatus(`Created ${form.email} as ${form.role}.`);
      setForm(EMPTY);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1>User management</h1>
        <p>Create accounts for Sales, Documentation, and Admin personnel.</p>

        <form onSubmit={handleSubmit} className="inline-form">
          {error && <p className="field-error">{error}</p>}
          {status && <p className="field-note">{status}</p>}

          <div className="form-row">
            <label>
              First name
              <input
                value={form.firstName}
                required
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </label>
            <label>
              Last name
              <input
                value={form.lastName}
                required
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Work email
              <input
                type="email"
                value={form.email}
                required
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Temporary password
              <input
                type="text"
                value={form.password}
                required
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Role
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as Exclude<Role, 'buyer'>,
                  })
                }
              >
                <option value={Role.SALES}>Sales</option>
                <option value={Role.DOCUMENTATION}>Documentation</option>
                <option value={Role.ADMIN}>Admin</option>
              </select>
            </label>
            <label>
              Department
              <input
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
              />
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create staff account'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Employee accounts ({staff.length})</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  No employee accounts yet.
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.uid}>
                  <td>{fullNameOf(s)}</td>
                  <td>{s.email}</td>
                  <td>
                    <span className={`tag tag-${s.role}`}>{s.role}</span>
                  </td>
                  <td>{s.department || '—'}</td>
                  <td>{s.active ? 'Active' : 'Deactivated'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
