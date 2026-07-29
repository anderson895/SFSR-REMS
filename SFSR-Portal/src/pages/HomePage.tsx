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
  useProjectSummaries,
  useTypeSummaries,
} from '../units/useUnits';

const ANY = 'any';

/**
 * Public landing page.
 *
 * Every figure shown here â€” unit counts, starting prices, unit types, project
 * names â€” is read live from Firestore rather than hard-coded. A brochure page
 * that claims "34 available units" while the inventory says otherwise is worse
 * than no page at all, and this one cannot drift out of date.
 */
export default function HomePage() {
  // Counts and features only genuinely available units â€” a unit someone else
  // is already processing should not be advertised as an option.
  const { summaries, totalAvailable, loading } = useTypeSummaries();
  const { projects } = useProjectSummaries();
  const navigate = useNavigate();

  const [project, setProject] = useState(ANY);
  const [type, setType] = useState(ANY);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const types = useMemo(
    () => [...new Set(summaries.map((s) => s.type))],
    [summaries],
  );

  const startingPrice = summaries.length
    ? Math.min(...summaries.map((s) => s.startingPrice))
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
    // data-fullbleed tells the shell to drop its centred column for this page.
    <div data-fullbleed>
      {/* ------------------------------------------------------------ hero */}
      <section className="bg-[linear-gradient(rgba(23,51,31,0.55),rgba(23,51,31,0.35)),url('/hero.jpg')] bg-cover bg-center px-6 pb-24 pt-18 text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-10 lg:flex-row">
          <div className="max-w-[34rem] pt-6">
            <h1 className="text-[clamp(2.1rem,4.6vw,3.4rem)] font-bold leading-[1.1] tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">
              Find Your Perfect Home.
            </h1>
            <p className="mb-8 mt-4 max-w-[34ch] leading-relaxed [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]">
              Explore our quality condominium projects and reserve your dream
              unit online.
            </p>
            <div className="flex flex-wrap gap-3.5">
              <Link to="/projects" className="btn btn-brand">
                Browse Projects
              </Link>
              <Link to="/schedule-tripping" className="btn btn-on-photo">
                <CalendarDaysIcon className="icon" />
                Schedule Tripping
              </Link>
            </div>
          </div>

          <aside className="w-full shrink-0 rounded-xl bg-white/96 p-6 text-ink shadow-2xl lg:w-80">
            <h2 className="mb-4 text-base font-semibold">Why Choose Us?</h2>
            <ul className="grid gap-4">
              {WHY_US.map(({ Icon, title, body }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 text-brand">
                    <Icon className="icon" />
                  </span>
                  <div>
                    <strong className="block text-[0.88rem]">{title}</strong>
                    <p className="mt-0.5 text-xs leading-snug text-gray-500">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {/* Pulled up over the hero's lower edge, as in the reference design. */}
      <form
        className="relative z-10 mx-auto -mt-13 flex w-[calc(100%-3rem)] max-w-[1180px] flex-wrap items-center gap-3 rounded-xl bg-brand px-5 py-4 shadow-xl"
        onSubmit={handleSearch}
      >
        <span className="pr-2 font-semibold text-white">Find Your Ideal Unit</span>

        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="min-w-36 flex-1 rounded-md border border-transparent bg-white px-3 py-2.5 text-sm text-ink"
        >
          <option value={ANY}>All Projects</option>
          {projects.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="min-w-36 flex-1 rounded-md border border-transparent bg-white px-3 py-2.5 text-sm text-ink"
        >
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
          className="min-w-36 flex-1 rounded-md border border-transparent bg-white px-3 py-2.5 text-sm text-ink"
        />
        <input
          type="number"
          placeholder="Max. Price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="min-w-36 flex-1 rounded-md border border-transparent bg-white px-3 py-2.5 text-sm text-ink"
        />

        <button type="submit" className="btn btn-accent shrink-0 px-6 py-2.5">
          Search Units
        </button>
      </form>

      {!loading && totalAvailable > 0 && (
        <p className="mx-auto mt-4 w-[calc(100%-3rem)] max-w-[1180px] text-sm text-gray-500">
          <strong className="text-brand">{totalAvailable}</strong> units
          available today &middot; starting at{' '}
          <strong className="text-brand">
            {formatPesoShort(startingPrice)}
          </strong>
        </p>
      )}

      {/* ------------------------------------------- steps + featured split */}
      <div className="mx-auto grid w-[calc(100%-3rem)] max-w-[1180px] items-start gap-10 py-12 lg:grid-cols-[5fr_7fr]">
        <section>
          <h2 className="mb-6 text-xl font-semibold">Simple Steps to Reserve</h2>
          <ol className="mb-6 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            {STEPS.map(({ Icon, title, body }, index) => (
              <li key={title} className="flex flex-col items-center">
                <span className="relative mb-3 inline-flex size-14 items-center justify-center rounded-full bg-brand-tint text-brand">
                  <Icon className="size-6" />
                  <span className="absolute -left-1 -top-1 flex size-6 items-center justify-center rounded-full bg-brand text-[0.72rem] font-bold text-white">
                    {index + 1}
                  </span>
                </span>
                <strong className="text-[0.82rem] leading-tight">{title}</strong>
                <p className="mt-1 text-xs leading-snug text-gray-500">{body}</p>
              </li>
            ))}
          </ol>
          <Link to="/how-it-works" className="btn btn-outline">
            How It Works
          </Link>
        </section>

        <section>
          <header className="flex items-baseline justify-between gap-4">
            <h2 className="mb-6 text-xl font-semibold">Featured Projects</h2>
            <Link
              to="/projects"
              className="whitespace-nowrap text-sm font-semibold text-brand no-underline hover:text-accent"
            >
              View All Projects &rarr;
            </Link>
          </header>
          <ProjectCarousel />
        </section>
      </div>

      {/* -------------------------------------------------- assurance strip */}
      <section className="card mx-auto mb-12 grid w-[calc(100%-3rem)] max-w-[1180px] gap-5 px-6 py-5 sm:grid-cols-2">
        {ASSURANCES.map(({ Icon, title, body }) => (
          <div key={title} className="flex items-center gap-3.5">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
              <Icon className="icon" />
            </span>
            <div>
              <strong className="text-sm">{title}</strong>
              <p className="mt-0.5 text-xs text-gray-500">{body}</p>
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
  const { projects, loading } = useProjectSummaries();
  const track = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    track.current?.scrollBy({
      left: direction * 260,
      behavior: 'smooth',
    });
  }

  if (loading) {
    return <p className="py-8 text-center text-gray-500">Loading projectsâ€¦</p>;
  }

  if (projects.length === 0) {
    return <p className="text-sm text-gray-500">No projects are listed yet.</p>;
  }

  const arrow =
    'size-8 shrink-0 cursor-pointer rounded-full border border-line bg-white text-xl leading-none text-brand hover:bg-brand-tint';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={arrow}
        aria-label="Previous projects"
        onClick={() => scrollBy(-1)}
      >
        &#8249;
      </button>

      {/* scrollbar-none keeps the strip clean; the arrows and native swipe are
          the affordances. */}
      <div
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 scrollbar-none"
        ref={track}
      >
        {projects.map((p) => (
          <Link
            key={p.name}
            to={`/units?project=${encodeURIComponent(p.name)}`}
            className="card w-46 shrink-0 snap-start overflow-hidden no-underline transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="h-30 bg-brand-tint">
              {p.image && (
                <img
                  src={p.image}
                  alt={p.name}
                  className="size-full object-cover"
                />
              )}
            </div>
            <div className="px-3 pb-3.5 pt-2.5">
              <strong className="block text-[0.85rem] leading-tight">
                {p.name}
              </strong>
              <p className="mb-2 mt-0.5 text-xs text-gray-500">{p.location}</p>
              <p className="text-[0.68rem] text-gray-500">Price starts at</p>
              <p className="mt-0.5 text-lg font-bold text-brand">
                {formatPesoShort(p.startingPrice)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <button
        type="button"
        className={arrow}
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
 * Emoji render as a different glyph on every platform â€” and in colour, which
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
