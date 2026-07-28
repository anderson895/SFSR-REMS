import { Link } from 'react-router-dom';
import { formatPesoShort, useProjects } from '../units/useUnits';

/**
 * Browse by development rather than by unit.
 *
 * With one project the unit list was enough; with three, a buyer choosing
 * between Makati and Ortigas should not have to infer the developments from a
 * filter dropdown on a list of 900 units.
 */
export default function ProjectsPage() {
  const { projects, loading, error } = useProjects();

  if (loading) {
    return <p className="py-8 text-center text-gray-500">Loading projects…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="mt-0 text-lg font-semibold text-red-800">
          Could not load projects
        </h2>
        <p className="mb-0 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="mb-1 text-3xl font-bold">Our Projects</h1>
        <p className="text-gray-500">
          {projects.length} condominium development
          {projects.length === 1 ? '' : 's'} currently on offer.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="mt-0 text-lg font-semibold">No projects listed</h2>
          <p className="mb-0 text-gray-500">
            There is no inventory in the system yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {projects.map((p) => (
            <article
              key={p.name}
              className="card grid overflow-hidden md:grid-cols-[2fr_3fr]"
            >
              <div className="min-h-52 bg-brand-tint">
                {p.image && (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="size-full object-cover"
                  />
                )}
              </div>

              <div className="p-6">
                <h2 className="m-0 text-xl font-semibold">{p.name}</h2>
                {p.location && (
                  <p className="mb-4 mt-1 text-sm text-gray-500">{p.location}</p>
                )}

                <dl className="mb-4 flex flex-wrap gap-7">
                  <div>
                    <dt className="text-[0.72rem] uppercase tracking-wider text-gray-500">
                      Price starts at
                    </dt>
                    <dd className="m-0 mt-0.5 text-2xl font-semibold text-brand">
                      {formatPesoShort(p.startingPrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] uppercase tracking-wider text-gray-500">
                      Available units
                    </dt>
                    <dd className="m-0 mt-0.5 font-semibold">
                      {p.availableCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] uppercase tracking-wider text-gray-500">
                      Unit types
                    </dt>
                    <dd className="m-0 mt-0.5 font-semibold">
                      {p.types.join(', ')}
                    </dd>
                  </div>
                </dl>

                {p.amenities.length > 0 && (
                  <ul className="mb-5 flex flex-wrap gap-1.5">
                    {p.amenities.slice(0, 6).map((amenity) => (
                      <li
                        key={amenity}
                        className="rounded-full bg-brand-tint px-2.5 py-1 text-xs text-brand"
                      >
                        {amenity}
                      </li>
                    ))}
                    {p.amenities.length > 6 && (
                      <li className="px-1 py-1 text-xs text-gray-500">
                        +{p.amenities.length - 6} more
                      </li>
                    )}
                  </ul>
                )}

                <Link
                  to={`/units?project=${encodeURIComponent(p.name)}`}
                  className="btn btn-brand"
                >
                  View available units
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
