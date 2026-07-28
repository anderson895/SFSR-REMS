import { signOutUser } from '@sfsr/shared';
import { Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import RequireBuyer from './auth/RequireBuyer';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import MyReservationsPage from './pages/MyReservationsPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ReservationDetailPage from './pages/ReservationDetailPage';
import ReservePage from './pages/ReservePage';
import UnitDetailPage from './pages/UnitDetailPage';
import UnitsPage from './pages/UnitsPage';

/**
 * Shell for the Web-Based Real Estate Portal.
 *
 * Unit browsing (M3), reservation (M4), and document upload (M5) slot in as
 * those milestones land.
 */
export default function App() {
  return (
    <div className="app">
      <TopBar />
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/units" element={<UnitsPage />} />
          <Route path="/units/:unitId" element={<UnitDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/units/:unitId/reserve"
            element={
              <RequireBuyer>
                <ReservePage />
              </RequireBuyer>
            }
          />
          <Route
            path="/reservations"
            element={
              <RequireBuyer>
                <MyReservationsPage />
              </RequireBuyer>
            }
          />
          <Route
            path="/reservations/:reservationId"
            element={
              <RequireBuyer>
                <ReservationDetailPage />
              </RequireBuyer>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireBuyer>
                <ProfilePage />
              </RequireBuyer>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        St. Francis Square Realty Corporation &middot; SFSR-REMS
      </footer>
    </div>
  );
}

function TopBar() {
  const { user, profile, loading } = useAuth();

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <img src="/logo.jpg" alt="St. Francis Square Realty" className="brand-logo" />
        <span className="brand-text">
          St. Francis Square Realty
          <small>Real Estate Portal</small>
        </span>
      </Link>

      <nav className="topnav">
        <Link to="/units">Available units</Link>
        {loading ? null : user ? (
          <>
            <Link to="/reservations">My reservations</Link>
            <Link to="/profile">
              {profile?.firstName ? `Hi, ${profile.firstName}` : 'My profile'}
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void signOutUser()}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Sign in</Link>
            <Link to="/register" className="btn btn-gold">
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

function NotFound() {
  return (
    <div className="notice">
      <h2>Page not found</h2>
      <p>
        The page you are looking for does not exist. <Link to="/">Go home</Link>
      </p>
    </div>
  );
}
