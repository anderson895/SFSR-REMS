import { AccountType, updateOwnProfile } from '@sfsr/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    mobile: '',
    address: '',
    birthDate: '',
  });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      firstName: profile.firstName ?? '',
      middleName: profile.middleName ?? '',
      lastName: profile.lastName ?? '',
      mobile: profile.mobile ?? '',
      address: profile.address ?? '',
      birthDate: profile.birthDate ?? '',
    });
  }, [profile]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setStatus('');
    try {
      await updateOwnProfile(user.uid, form);
      setStatus('Profile saved.');
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <p className="loading">Loading your profile…</p>;

  const isClient = profile.accountType === AccountType.CLIENT;

  return (
    <div className="form-card form-card-wide">
      <h1>My profile</h1>

      <div className={`account-badge ${isClient ? 'is-client' : 'is-initial'}`}>
        <strong>{isClient ? 'Client Account' : 'Initial Account'}</strong>
        <span>
          {isClient
            ? 'Your reservation has been approved. You have full Client Portal access.'
            : 'Your account is upgraded to a Client Account once a reservation is approved.'}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
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
            Middle name
            <input
              value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value })}
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

        <label>
          Email address
          <input value={profile.email} disabled />
        </label>

        <div className="form-row">
          <label>
            Mobile number
            <input
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
          </label>
          <label>
            Date of birth
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            />
          </label>
        </div>

        <label>
          Present address
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
