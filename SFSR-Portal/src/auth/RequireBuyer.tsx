import { Role, signOutUser } from '@sfsr/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Gate for buyer-only pages on the Web Portal.
 *
 * Staff accounts are refused here rather than silently allowed: employees carry
 * out administrative work through the Internal Management System, which the
 * study restricts to the company network.
 */
export default function RequireBuyer({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="loading">Loading…</p>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (profile && profile.role !== Role.BUYER) {
    return (
      <div className="notice notice-error">
        <h2>Wrong application</h2>
        <p>
          This account belongs to St. Francis Square Realty staff. Employee
          functions are available only through the Internal Management System on
          the company network.
        </p>
        <button type="button" className="btn" onClick={() => void signOutUser()}>
          Sign out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
