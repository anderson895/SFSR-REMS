import { CheckCircleIcon } from '@heroicons/react/24/outline';
import {
  TRIPPING_SLOTS,
  createTrippingRequest,
  fullNameOf,
} from '@sfsr/shared';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useProjectSummaries } from '../units/useUnits';

/**
 * Book a site visit.
 *
 * Behind `RequireBuyer`, so `user` is always present by the time this renders.
 * Details pre-fill from the profile and the request is stamped with the
 * buyer's uid, which is what `firestore.rules` matches on for both the write
 * and the buyer's later read of their own request.
 */
export default function ScheduleTrippingPage() {
  const { profile, user } = useAuth();
  const { projects } = useProjectSummaries();
  const [params] = useSearchParams();

  const [form, setForm] = useState({
    projectName: params.get('project') ?? '',
    fullName: '',
    email: '',
    mobile: '',
    preferredDate: '',
    preferredSlot: TRIPPING_SLOTS[0] as string,
    partySize: '2',
    message: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Site visits are booked ahead, and the office does not take same-day
  // requests â€” so tomorrow is the earliest date the picker will accept.
  const earliestDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (!profile) return;
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || fullNameOf(profile),
      email: prev.email || profile.email || '',
      mobile: prev.mobile || profile.mobile || '',
    }));
  }, [profile]);

  // The default project can only be chosen once the inventory has loaded.
  useEffect(() => {
    if (!form.projectName && projects.length > 0) {
      setForm((prev) => ({ ...prev, projectName: projects[0].name }));
    }
  }, [projects, form.projectName]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    setError('');
    setBusy(true);

    try {
      await createTrippingRequest({
        ...form,
        partySize: Number(form.partySize) || 1,
        requestedByUid: user.uid,
      });
      setDone(true);
    } catch (err) {
      setError(
        (err as Error).message ??
          'Could not submit your request. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="form-card">
        <p className="mb-2 text-green-700">
          <CheckCircleIcon className="size-11" />
        </p>
        <h1>Request received</h1>
        <p className="form-sub">
          Our sales team will confirm your site visit by phone or email. Nothing
          is reserved by this request â€” it is a viewing appointment only.
        </p>
        <dl className="spec-list">
          <div>
            <dt>Project</dt>
            <dd>{form.projectName}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{form.preferredDate}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{form.preferredSlot}</dd>
          </div>
        </dl>
        <Link to="/units" className="btn btn-brand btn-block mt-4">
          Browse available units
        </Link>
      </div>
    );
  }

  return (
    <div className="form-card form-card-wide">
      <h1>Schedule a Tripping</h1>
      <p className="form-sub">
        Visit the site and see the model unit in person. Our sales team will
        confirm your slot before the date.
      </p>

      <form onSubmit={handleSubmit}>
        {error && <p className="field-error">{error}</p>}

        <label>
          Project
          <select
            value={form.projectName}
            required
            onChange={(e) => setForm({ ...form, projectName: e.target.value })}
          >
            {projects.length === 0 && <option value="">Loadingâ€¦</option>}
            {projects.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
                {p.location && ` â€” ${p.location}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Full name
          <input
            value={form.fullName}
            required
            minLength={2}
            maxLength={120}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </label>

        <div className="form-row">
          <label>
            Email address
            <input
              type="email"
              value={form.email}
              required
              maxLength={200}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Mobile number
            <input
              value={form.mobile}
              required
              minLength={7}
              maxLength={20}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Preferred date
            <input
              type="date"
              value={form.preferredDate}
              required
              min={earliestDate}
              onChange={(e) =>
                setForm({ ...form, preferredDate: e.target.value })
              }
            />
          </label>
          <label>
            Preferred time
            <select
              value={form.preferredSlot}
              onChange={(e) =>
                setForm({ ...form, preferredSlot: e.target.value })
              }
            >
              {TRIPPING_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>
          <label>
            Number of visitors
            <input
              type="number"
              min={1}
              max={10}
              value={form.partySize}
              required
              onChange={(e) => setForm({ ...form, partySize: e.target.value })}
            />
          </label>
        </div>

        <label>
          Anything we should know? <span className="optional">(optional)</span>
          <input
            value={form.message}
            maxLength={500}
            placeholder="e.g. interested in the 2BR corner units"
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </label>

        {/* Above the button, not below it: `.hint` carries a negative top
            margin so it tucks under the field before it, and it explains what
            the button is about to do. */}
        <p className="hint">
          This books a viewing only. No unit is held or reserved.
        </p>

        <button type="submit" className="btn btn-brand btn-block" disabled={busy}>
          {busy ? 'Submittingâ€¦' : 'Request site visit'}
        </button>
      </form>
    </div>
  );
}
