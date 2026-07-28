import { Link } from 'react-router-dom';

/**
 * The reservation process, end to end.
 *
 * Describes the flow the system actually enforces — the hold placed at
 * submission, the automated check on each upload, the staff review — rather
 * than a generic marketing summary. A buyer who reads this should not be
 * surprised by anything the portal later does.
 */
export default function HowItWorksPage() {
  return (
    <>
      <div className="page-head">
        <h1>How It Works</h1>
        <p>From browsing to an approved reservation.</p>
      </div>

      <ol className="steps">
        <li>
          <span className="step-no">1</span>
          <h3>Browse</h3>
          <p>
            View projects, units, floor areas and prices. No account is needed
            to look around.
          </p>
        </li>
        <li>
          <span className="step-no">2</span>
          <h3>Register</h3>
          <p>
            Create an account using your name exactly as it appears on your
            valid ID. Every document you upload is checked against this name.
          </p>
        </li>
        <li>
          <span className="step-no">3</span>
          <h3>Reserve</h3>
          <p>
            The unit is placed <strong>On Hold</strong> the moment you submit, so
            no one else can reserve it while you complete your requirements. You
            may cancel while the reservation is still open, which returns the
            unit to the listing.
          </p>
        </li>
        <li>
          <span className="step-no">4</span>
          <h3>Upload documents</h3>
          <p>
            Submit your valid ID, proof of billing, income documents and proof of
            payment. Each file is read automatically on upload and checked
            against the document type you selected and the name you registered.
          </p>
        </li>
        <li>
          <span className="step-no">5</span>
          <h3>Approval</h3>
          <p>
            Our staff review every document — the automated check is a
            recommendation, never the final word. Once approved, the unit is
            yours and your account unlocks the Client Portal.
          </p>
        </li>
      </ol>

      <div className="section-foot">
        <Link to="/units" className="btn btn-brand btn-inline">
          Browse available units
        </Link>
      </div>
    </>
  );
}
