/**
 * Consent text, reservation terms, and the buyer's declaration.
 *
 * Transcribed verbatim from the reservation specification rather than
 * paraphrased. These are the statements a buyer legally agrees to, and the
 * record of that agreement is only meaningful if the wording stored alongside
 * it is the wording they were actually shown — so the text lives here, is
 * versioned, and the version is written onto the record.
 */

/**
 * Bumped whenever any wording below changes.
 *
 * Stored with each acceptance so an old record still says which text was
 * agreed to, instead of silently appearing to accept today's terms.
 */
export const LEGAL_VERSION = '2026-07';

/** Registration consent, required by the Data Privacy Act of 2012. */
export const REGISTRATION_CONSENTS = [
  {
    id: 'truthful',
    text: 'I certify that the information provided is true and correct.',
  },
  {
    id: 'terms',
    text: 'I have read and agree to the Terms and Conditions and Privacy Policy.',
  },
  {
    id: 'privacy',
    text:
      'I authorize St. Francis Square Realty Corporation to collect and process ' +
      'my personal information in accordance with the Data Privacy Act of 2012 ' +
      '(Republic Act No. 10173) for reservation processing and other legitimate ' +
      'business purposes.',
  },
] as const;

/** The eleven reservation terms, shown before a reservation may be submitted. */
export const RESERVATION_TERMS = [
  'The reservation application shall be processed only after the reservation fee has been verified by the Billing Department.',
  'Once payment has been verified, the selected unit shall be placed under On Hold status while the reservation is being evaluated.',
  'The Buyer shall submit all required documentary requirements within thirty (30) calendar days from the reservation date.',
  'The reservation fee shall form part of the purchase price and is NON-REFUNDABLE and NON-TRANSFERABLE, except when the reservation is cancelled by St. Francis Square Realty Corporation due to reasons attributable to the company or as otherwise required by applicable law.',
  'Failure to submit the required documents, failure to comply with the approved payment schedule, submission of false or fraudulent information, or voluntary withdrawal of the reservation application may result in cancellation of the reservation in accordance with company policy and applicable laws.',
  'Submission of proof of payment does not automatically constitute payment confirmation. All payments remain subject to verification by the Billing and Accounting Departments.',
  'All uploaded documents shall be processed using OCR technology to assist in document validation. Final approval shall be made by authorized company personnel.',
  'This reservation is personal to the Buyer and may not be assigned or transferred without the prior written consent of St. Francis Square Realty Corporation.',
  'The Developer reserves the right to make reasonable changes to building plans, specifications, finishes, and materials due to engineering requirements, government regulations, or material availability.',
  'The Developer reserves the right to approve, reject, or cancel any reservation application that does not comply with company policies or legal requirements.',
  'Personal information collected through this system shall be processed in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and shall be used solely for reservation processing, financing, billing, customer support, and other legitimate business purposes.',
] as const;

/** The buyer's declaration. Every item must be ticked to submit. */
export const BUYER_DECLARATIONS = [
  {
    id: 'true_and_correct',
    text: 'I certify that all information provided in this reservation application is true, complete, and correct.',
  },
  {
    id: 'reviewed',
    text: 'I have carefully reviewed all information entered in this reservation application.',
  },
  {
    id: 'not_automatic',
    text: 'I understand that submitting this reservation application does not automatically approve my reservation.',
  },
  {
    id: 'subject_to_verification',
    text: 'I understand that my uploaded proof of payment and documentary requirements are subject to verification.',
  },
  {
    id: 'agree_terms',
    text: 'I have read, understood, and voluntarily agree to the Reservation Terms and Conditions.',
  },
] as const;

/** What is stored when someone accepts something. */
export interface ConsentRecord {
  /** Ids of the statements accepted. */
  accepted: string[];
  /** Which wording they saw. */
  version: string;
  /** ISO timestamp, taken on the client at the moment of acceptance. */
  acceptedAt: string;
}

export function buildConsent(accepted: string[]): ConsentRecord {
  return {
    accepted,
    version: LEGAL_VERSION,
    acceptedAt: new Date().toISOString(),
  };
}
