import { UserCircleIcon } from '@heroicons/react/24/outline';
import { signOutUser } from '@sfsr/shared';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import RequireBuyer from './auth/RequireBuyer';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import HomePage from './pages/HomePage';
import HowItWorksPage from './pages/HowItWorksPage';
import LoginPage from './pages/LoginPage';
import ProjectsPage from './pages/ProjectsPage';
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
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
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

/** Public sections, in the order the reference design lists them. */
const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/projects', label: 'Projects' },
  { to: '/units', label: 'Available Units' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
];

function TopBar() {
  const { user, profile, loading } = useAuth();

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <img
          src="/logo.jpg"
          alt="St. Francis Square Realty"
          className="brand-logo"
        />
        <span className="brand-text">
          St. Francis Square Realty
          <small>Real Estate Management System</small>
        </span>
      </Link>

      <nav className="topnav">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? 'is-active' : undefined)}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar-account">
        {loading ? null : user ? (
          <>
            <NavLink to="/reservations">My Reservations</NavLink>
            <Link to="/profile" className="btn btn-brand">
              <UserCircleIcon className="icon" />
              {profile?.firstName ?? 'My profile'}
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
          <Link to="/login" className="btn btn-brand">
            <UserCircleIcon className="icon" />
            Register / Login
          </Link>
        )}
      </div>
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
