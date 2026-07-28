import { useProjects } from '../units/useUnits';

export default function AboutPage() {
  const { projects } = useProjects();

  return (
    <>
      <div className="page-head">
        <h1>About Us</h1>
        <p>St. Francis Square Realty Corporation</p>
      </div>

      <section className="panel-card prose">
        <p>
          St. Francis Square Realty Corporation develops and sells residential
          condominium units in Metro Manila. We handle the sale end to end —
          from the first enquiry through documentary requirements to turnover.
        </p>

        <h2>This portal</h2>
        <p>
          The Real Estate Management System lets you browse live inventory,
          reserve a unit online, and submit your documentary requirements
          without visiting an office. Availability shown here is read directly
          from our records as it changes, so a unit that appears available is
          genuinely still on the market.
        </p>
        <p>
          Uploaded documents are read automatically and checked against the
          document type you selected and the name on your account. That check is
          a recommendation to our staff, not a decision — every reservation is
          reviewed by an authorised person before it is approved.
        </p>

        {projects.length > 0 && (
          <>
            <h2>Current developments</h2>
            <ul>
              {projects.map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong>
                  {p.location && <> — {p.location}</>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
