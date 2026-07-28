import { authErrorMessage, isStaffRole, signIn, signOutUser } from '@sfsr/shared';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { profile } = await signIn(email, password);

      // Reject buyer accounts at the door rather than letting them in and
      // hiding the menus — the message is clearer and nothing staff-only is
      // ever rendered.
      if (!profile || !isStaffRole(profile.role)) {
        await signOutUser();
        setError(
          'This account is not authorized for the Internal Management System.',
        );
        return;
      }

      navigate('/', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="form-card">
        <img src="/logo.png" alt="" className="login-logo" />
        <h1>Internal Management System</h1>
        <p className="form-sub">Authorized personnel only.</p>

        <form onSubmit={handleSubmit}>
          {error && <p className="field-error">{error}</p>}

          <label>
            Work email
            <input
              type="email"
              value={email}
              autoComplete="username"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
