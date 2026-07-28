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
import ScheduleTrippingPage from './pages/ScheduleTrippingPage';
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
    <div className="flex min-h-screen flex-col">
      <TopBar />
      {/* Most pages sit in a centred column. A page that needs the full width
          says so with `data-fullbleed`, which is checked here rather than the
          shell keeping its own list of edge-to-edge routes. */}
      <main
        className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8
                   has-[[data-fullbleed]]:max-w-none has-[[data-fullbleed]]:p-0"
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          {/* Sign-in required. A site visit commits staff time and a car, so
              it is worth an account — and pinning every request to a real uid
              is what lets firestore.rules close the anonymous write path. */}
          <Route
            path="/schedule-tripping"
            element={
              <RequireBuyer>
                <ScheduleTrippingPage />
              </RequireBuyer>
            }
          />
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
      <footer className="border-t border-line px-6 py-4 text-center text-sm text-gray-500">
        St. Francis Square Realty Corporation &middot; SFSR-REMS
      </footer>
    </div>
  );
}

/** Public sections, in the order the reference design lists them. */
const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/projects', label: 'Projects' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
];

function TopBar() {
  const { user, profile, loading } = useAuth();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-7 py-3">
      <Link to="/" className="flex items-center gap-3 no-underline">
        {/* The mark is a tall 71x128 glyph cropped to its ink, so height drives
            the size and the width follows. */}
        <img
          src="/logo.png"
          alt="St. Francis Square Realty"
          className="h-10 w-auto object-contain"
        />
        <span className="flex flex-col leading-tight">
          <span className="font-bold text-brand">St. Francis Square Realty</span>
          <span className="text-[0.62rem] font-medium uppercase tracking-[0.08em] text-gray-500">
            Real Estate Portal
          </span>
        </span>
      </Link>

      {/* order-3 + w-full drops the nav to its own line once the bar wraps,
          rather than letting it squeeze the brand and the account button. */}
      <nav className="order-3 flex w-full items-center gap-6 overflow-x-auto lg:order-none lg:w-auto">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 py-1.5 text-sm no-underline ${
                isActive
                  ? 'border-brand font-semibold text-brand'
                  : 'border-transparent text-ink hover:text-brand'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        {loading ? null : user ? (
          <>
            <NavLink
              to="/reservations"
              className="whitespace-nowrap text-sm text-ink no-underline hover:text-brand"
            >
              My Reservations
            </NavLink>
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
    <div className="card p-8 text-center">
      <h2 className="mt-0 text-xl font-semibold">Page not found</h2>
      <p className="text-gray-500">
        The page you are looking for does not exist.{' '}
        <Link to="/" className="font-semibold text-brand">
          Go home
        </Link>
      </p>
    </div>
  );
}
