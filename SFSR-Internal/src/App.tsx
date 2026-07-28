import { Role, fullNameOf, signOutUser } from '@sfsr/shared';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import RequireStaff from './auth/RequireStaff';
import AuditTrailPage from './pages/AuditTrailPage';
import ReservationDetailPage from './pages/ReservationDetailPage';
import ReservationsPage from './pages/ReservationsPage';
import StaffLoginPage from './pages/StaffLoginPage';
import TrippingPage from './pages/TrippingPage';
import UserManagementPage from './pages/UserManagementPage';
import WalkInReservationPage from './pages/WalkInReservationPage';

/**
 * Shell for the Internal Management System.
 *
 * Reservation management (M4), document review with OCR and Levenshtein
 * results (M6), and approval (M7) slot in as those milestones land.
 */
export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <p className="loading">Loading…</p>;
  if (!user) return <StaffLoginPage />;

  return (
    <div className="app">
      <TopBar />
      <div className="shell">
        <SideNav />
        <main className="content">
          <Routes>
            <Route
              path="/"
              element={
                <RequireStaff>
                  <Dashboard />
                </RequireStaff>
              }
            />
            <Route
              path="/reservations"
              element={
                <RequireStaff>
                  <ReservationsPage />
                </RequireStaff>
              }
            />
            <Route
              path="/reservations/new"
              element={
                <RequireStaff allow={[Role.SALES, Role.ADMIN]}>
                  <WalkInReservationPage />
                </RequireStaff>
              }
            />
            <Route
              path="/reservations/:reservationId"
              element={
                <RequireStaff>
                  <ReservationDetailPage />
                </RequireStaff>
              }
            />
            <Route
              path="/tripping"
              element={
                <RequireStaff>
                  <TrippingPage />
                </RequireStaff>
              }
            />
            <Route
              path="/audit"
              element={
                <RequireStaff allow={[Role.ADMIN]}>
                  <AuditTrailPage />
                </RequireStaff>
              }
            />
            <Route
              path="/users"
              element={
                <RequireStaff allow={[Role.ADMIN]}>
                  <UserManagementPage />
                </RequireStaff>
              }
            />
            <Route path="/login" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function TopBar() {
  const { profile } = useAuth();

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <img src="/logo.png" alt="SFSR" className="brand-logo" />
        <span className="brand-text">
          SFSR
          <small>Internal Management System</small>
        </span>
      </Link>

      <div className="topnav">
        {profile && (
          <span className="whoami">
            {fullNameOf(profile)}
            <small>{profile.role}</small>
          </span>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void signOutUser()}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

function SideNav() {
  const { profile } = useAuth();

  return (
    <nav className="sidenav">
      <NavLink to="/" end>
        Dashboard
      </NavLink>
      <NavLink to="/reservations">Reservations</NavLink>
      <NavLink to="/tripping">Site Visits</NavLink>
      {profile?.role === Role.ADMIN && (
        <>
          <NavLink to="/audit">Audit trail</NavLink>
          <NavLink to="/users">User management</NavLink>
        </>
      )}
    </nav>
  );
}

function Dashboard() {
  const { profile } = useAuth();

  return (
    <section className="panel">
      <h1>Welcome, {profile?.firstName}</h1>
      <p>
        Reservation processing, document verification, and property inventory
        management for authorized employees.
      </p>
      <Link to="/reservations" className="btn btn-primary">
        Go to reservations
      </Link>
    </section>
  );
}

function NotFound() {
  return (
    <div className="notice">
      <h2>Page not found</h2>
      <p>
        <Link to="/">Return to the dashboard</Link>
      </p>
    </div>
  );
}
