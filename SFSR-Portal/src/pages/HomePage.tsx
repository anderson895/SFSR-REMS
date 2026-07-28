import {
  ArrowUpTrayIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  HomeModernIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { type ComponentType, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  formatPesoShort,
  useBrowsableUnits,
  useProjects,
} from '../units/useUnits';

const ANY = 'any';

/**
 * Public landing page.
 *
 * Every figure shown here — unit counts, starting prices, unit types, project
 * names — is read live from Firestore rather than hard-coded. A brochure page
 * that claims "34 available units" while the inventory says otherwise is worse
 * than no page at all, and this one cannot drift out of date.
 */
export default function HomePage() {
  // Counts and features only genuinely available units — a unit someone else
  // is already processing should not be advertised as an option.
  const { available: units, loading } = useBrowsableUnits();
  const { projects } = useProjects();
  const navigate = useNavigate();

  const [project, setProject] = useState(ANY);
  const [type, setType] = useState(ANY);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const types = useMemo(
    () => [...new Set(units.map((u) => u.type))],
    [units],
  );

  const startingPrice = units.length
    ? Math.min(...units.map((u) => u.price))
    : 0;

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (project !== ANY) params.set('project', project);
    if (type !== ANY) params.set('type', type);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    navigate(`/units?${params.toString()}`);
  }

  return (
    <div className="home">
      {/* ------------------------------------------------------------ hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <h1>Find Your Perfect Home.</h1>
            <p>
              Explore our quality condominium projects and reserve your dream
              unit online.
            </p>
            <div className="hero-actions">
              <Link to="/projects" className="btn btn-brand">
                Browse Projects
              </Link>
              <Link to="/units" className="btn btn-on-photo">
                View Available Units
              </Link>
            </div>
          </div>

          <aside className="why-card">
            <h2>Why Choose Us?</h2>
            <ul>
              {WHY_US.map(({ Icon, title, body }) => (
                <li key={title}>
                  <span className="why-icon">
                    <Icon className="icon" />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {/* ---------------------------------------------------- search panel */}
      <form className="unit-search" onSubmit={handleSearch}>
        <span className="unit-search-label">Find Your Ideal Unit</span>

        <select value={project} onChange={(e) => setProject(e.target.value)}>
          <option value={ANY}>All Projects</option>
          {projects.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value={ANY}>Unit Type</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Min. Price"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <input
          type="number"
          placeholder="Max. Price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />

        <button type="submit" className="btn btn-accent">
          Search Units
        </button>
      </form>

      {!loading && units.length > 0 && (
        <p className="hero-stat">
          <strong>{units.length}</strong> units available today &middot; starting
          at <strong>{formatPesoShort(startingPrice)}</strong>
        </p>
      )}

      {/* ------------------------------------------- steps + featured split */}
      <div className="home-split">
        <section className="steps-col">
          <h2>Simple Steps to Reserve</h2>
          <ol className="step-row">
            {STEPS.map(({ Icon, title, body }, index) => (
              <li key={title}>
                <span className="step-icon">
                  <Icon className="icon" />
                  <span className="step-badge">{index + 1}</span>
                </span>
                <strong>{title}</strong>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <Link to="/how-it-works" className="btn btn-outline">
            How It Works
          </Link>
        </section>

        <section className="featured-col">
          <header className="section-head-row">
            <h2>Featured Projects</h2>
            <Link to="/projects" className="text-link">
              View All Projects &rarr;
            </Link>
          </header>
          <ProjectCarousel />
        </section>
      </div>

      {/* -------------------------------------------------- assurance strip */}
      <section className="assurance">
        {ASSURANCES.map(({ Icon, title, body }) => (
          <div key={title}>
            <span className="assurance-icon">
              <Icon className="icon" />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/**
 * Horizontally scrolling project strip.
 *
 * Uses native scrolling with CSS snap points rather than a transform-driven
 * slider: it keeps keyboard, touch and trackpad behaviour for free, and the
 * arrows just nudge `scrollLeft`.
 */
function ProjectCarousel() {
  const { projects, loading } = useProjects();
  const track = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    track.current?.scrollBy({
      left: direction * 260,
      behavior: 'smooth',
    });
  }

  if (loading) return <p className="loading">Loading projects…</p>;

  if (projects.length === 0) {
    return <p className="hint">No projects are listed yet.</p>;
  }

  return (
    <div className="carousel">
      <button
        type="button"
        className="carousel-arrow"
        aria-label="Previous projects"
        onClick={() => scrollBy(-1)}
      >
        &#8249;
      </button>

      <div className="carousel-track" ref={track}>
        {projects.map((p) => (
          <Link
            key={p.name}
            to={`/units?project=${encodeURIComponent(p.name)}`}
            className="project-card"
          >
            <div className="project-card-media">
              {p.image && <img src={p.image} alt={p.name} />}
            </div>
            <div className="project-card-body">
              <strong>{p.name}</strong>
              <p className="project-card-loc">{p.location}</p>
              <p className="project-card-from">Price starts at</p>
              <p className="project-card-price">
                {formatPesoShort(p.startingPrice)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <button
        type="button"
        className="carousel-arrow"
        aria-label="Next projects"
        onClick={() => scrollBy(1)}
      >
        &#8250;
      </button>
    </div>
  );
}

/**
 * Heroicons rather than emoji.
 *
 * Emoji render as a different glyph on every platform — and in colour, which
 * fights the palette instead of inheriting it. These are plain SVG that take
 * `currentColor`, so one CSS rule controls them all.
 */
interface Feature {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

const WHY_US: Feature[] = [
  {
    Icon: MapPinIcon,
    title: 'Prime Locations',
    body: 'Strategically located in key business and lifestyle districts.',
  },
  {
    Icon: SparklesIcon,
    title: 'Quality Living',
    body: 'Thoughtfully designed spaces for your comfort and lifestyle.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Secure & Reliable',
    body: 'Safe transactions and secure document management.',
  },
  {
    Icon: HomeModernIcon,
    title: 'Easy & Convenient',
    body: 'Reserve online and track your application anytime, anywhere.',
  },
];

const STEPS: Feature[] = [
  {
    Icon: UserPlusIcon,
    title: 'Create an Account',
    body: 'Register to get started with your reservation.',
  },
  {
    Icon: BuildingOffice2Icon,
    title: 'Choose a Unit',
    body: 'Browse available units and select your preferred one.',
  },
  {
    Icon: ArrowUpTrayIcon,
    title: 'Submit Requirements',
    body: 'Upload your documents and proof of payment online.',
  },
  {
    Icon: CheckBadgeIcon,
    title: 'Track & Update',
    body: 'Monitor your reservation status in real time.',
  },
];

const ASSURANCES: Feature[] = [
  {
    Icon: CalendarDaysIcon,
    title: 'Real-time Availability',
    body: 'Check unit availability the moment it changes.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Secure Document Upload',
    body: 'Your documents are validated on upload and kept private.',
  },
];
