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

  if (loading) return <p className="loading">Loading projects…</p>;

  if (error) {
    return (
      <div className="notice notice-error">
        <h2>Could not load projects</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Our Projects</h1>
        <p>
          {projects.length} condominium development
          {projects.length === 1 ? '' : 's'} currently on offer.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="notice">
          <h2>No projects listed</h2>
          <p>There is no inventory in the system yet.</p>
        </div>
      ) : (
        <div className="project-list">
          {projects.map((p) => (
            <article key={p.name} className="project-tile">
              <div className="project-tile-media">
                {p.image && <img src={p.image} alt={p.name} />}
              </div>

              <div className="project-tile-body">
                <h2>{p.name}</h2>
                {p.location && <p className="project-tile-loc">{p.location}</p>}

                <div className="project-tile-facts">
                  <div>
                    <dt>Price starts at</dt>
                    <dd className="is-price">
                      {formatPesoShort(p.startingPrice)}
                    </dd>
                  </div>
                  <div>
                    <dt>Available units</dt>
                    <dd>{p.availableCount}</dd>
                  </div>
                  <div>
                    <dt>Unit types</dt>
                    <dd>{p.types.join(', ')}</dd>
                  </div>
                </div>

                {p.amenities.length > 0 && (
                  <ul className="project-tile-amenities">
                    {p.amenities.slice(0, 6).map((amenity) => (
                      <li key={amenity}>{amenity}</li>
                    ))}
                    {p.amenities.length > 6 && (
                      <li className="is-more">
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
