import {
  BuildingOffice2Icon,
  ClockIcon,
  EnvelopeIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';

/**
 * Static contact details.
 *
 * No enquiry form on purpose: a form that silently goes nowhere is worse than
 * a phone number that works. If enquiries should land in the Internal app,
 * that needs a collection and a staff inbox to read it.
 */
export default function ContactPage() {
  return (
    <>
      <div className="page-head">
        <h1>Contact Us</h1>
        <p>Talk to our sales team about a unit or an existing reservation.</p>
      </div>

      <div className="contact-grid">
        <div className="panel-card contact-item">
          <span className="assurance-icon">
            <BuildingOffice2Icon className="icon" />
          </span>
          <div>
            <strong>Sales Office</strong>
            <p>
              St. Francis Square Realty Corporation
              <br />
              Mandaluyong City, Metro Manila
            </p>
          </div>
        </div>

        <div className="panel-card contact-item">
          <span className="assurance-icon">
            <PhoneIcon className="icon" />
          </span>
          <div>
            <strong>Phone</strong>
            <p>(02) 8000 0000</p>
          </div>
        </div>

        <div className="panel-card contact-item">
          <span className="assurance-icon">
            <EnvelopeIcon className="icon" />
          </span>
          <div>
            <strong>Email</strong>
            <p>
              <a href="mailto:sales@stfrancissquare.com">
                sales@stfrancissquare.com
              </a>
            </p>
          </div>
        </div>

        <div className="panel-card contact-item">
          <span className="assurance-icon">
            <ClockIcon className="icon" />
          </span>
          <div>
            <strong>Office Hours</strong>
            <p>
              Monday to Saturday
              <br />
              9:00 AM – 6:00 PM
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
