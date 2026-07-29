import { type Role, isStaffRole, signOutUser } from '@sfsr/shared';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface Props {
  children: ReactNode;
  /**
   * Restricts a page to specific roles. Omit to allow any staff member.
   * This is the Role-Based Access Control the study calls for: staff see only
   * the modules matching their responsibilities.
   */
  allow?: Role[];
}

export default function RequireStaff({ children, allow }: Props) {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading) return <p className="loading">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;

  // Auth resolves before the profile document does. Without this the check
  // below sees a null profile mid-flight and accuses every staff member of
  // being unauthorised for a moment on every reload.
  if (profileLoading) return <p className="loading">Loading…</p>;

  // A signed-in account with no profile document has no role, so it cannot be
  // trusted as staff.
  if (!profile || !isStaffRole(profile.role)) {
    return (
      <div className="notice notice-error">
        <h2>Access denied</h2>
        <p>
          This account is not authorized to use the Internal Management System.
          Client accounts should use the Web Portal instead.
        </p>
        <button type="button" className="btn" onClick={() => void signOutUser()}>
          Sign out
        </button>
      </div>
    );
  }

  if (!profile.active) {
    return (
      <div className="notice notice-error">
        <h2>Account deactivated</h2>
        <p>Contact your system administrator to restore access.</p>
        <button type="button" className="btn" onClick={() => void signOutUser()}>
          Sign out
        </button>
      </div>
    );
  }

  if (allow && !allow.includes(profile.role)) {
    return (
      <div className="notice notice-error">
        <h2>Insufficient permissions</h2>
        <p>
          Your role ({profile.role}) does not have access to this module. This
          module is limited to: {allow.join(', ')}.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
