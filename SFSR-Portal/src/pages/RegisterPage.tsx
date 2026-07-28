import { authErrorMessage, registerBuyer } from '@sfsr/shared';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const EMPTY = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  mobile: '',
  address: '',
  birthDate: '',
  password: '',
  confirmPassword: '',
};

/**
 * Buyer registration.
 *
 * The name captured here is what OCR results are later compared against by the
 * Levenshtein validator, so the fields are separated rather than collected as
 * one free-text box — a cleaner registered name means fewer false mismatches.
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      await registerBuyer({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        mobile: form.mobile,
        address: form.address,
        birthDate: form.birthDate,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card form-card-wide">
      <h1>Create an account</h1>
      <p className="form-sub">
        Registration lets you request a site tripping, reserve a unit, upload
        your requirements, and track your reservation.
      </p>

      <form onSubmit={handleSubmit}>
        {error && <p className="field-error">{error}</p>}

        <div className="form-row">
          <label>
            First name
            <input
              value={form.firstName}
              required
              onChange={(e) => set('firstName')(e.target.value)}
            />
          </label>
          <label>
            Middle name <span className="optional">(optional)</span>
            <input
              value={form.middleName}
              onChange={(e) => set('middleName')(e.target.value)}
            />
          </label>
          <label>
            Last name
            <input
              value={form.lastName}
              required
              onChange={(e) => set('lastName')(e.target.value)}
            />
          </label>
        </div>

        <p className="hint">
          Enter your name exactly as it appears on your government-issued ID.
          The system compares your uploaded documents against this name.
        </p>

        <div className="form-row">
          <label>
            Email address
            <input
              type="email"
              value={form.email}
              autoComplete="email"
              required
              onChange={(e) => set('email')(e.target.value)}
            />
          </label>
          <label>
            Mobile number
            <input
              value={form.mobile}
              placeholder="09XX XXX XXXX"
              onChange={(e) => set('mobile')(e.target.value)}
            />
          </label>
        </div>

        <label>
          Present address
          <input
            value={form.address}
            onChange={(e) => set('address')(e.target.value)}
          />
        </label>

        <label>
          Date of birth
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => set('birthDate')(e.target.value)}
          />
        </label>

        <div className="form-row">
          <label>
            Password
            <input
              type="password"
              value={form.password}
              autoComplete="new-password"
              required
              onChange={(e) => set('password')(e.target.value)}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={form.confirmPassword}
              autoComplete="new-password"
              required
              onChange={(e) => set('confirmPassword')(e.target.value)}
            />
          </label>
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="form-foot">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
