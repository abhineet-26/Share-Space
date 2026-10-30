/**
 * Centralized Institutional Contact & Organization Configuration for SHARESPACE.
 *
 * NOTE FOR PRODUCTION DEPLOYMENT / OWNER REVIEW:
 * Update the placeholders below with the verified institutional or legal entity details
 * before official campus-wide or multi-institutional production rollout.
 */

export interface InstitutionalContactConfig {
  organizationName: string;
  departmentName: string;
  campusName: string;
  legalEntityNotice: string;
  supportEmail: string;
  securityEmail: string;
  generalInquiriesEmail: string;
  officeLocation: string;
  postalAddress: string;
  phone: string;
  officeHours: string;
  isOwnerConfirmed: boolean;
}

export const contactConfig: InstitutionalContactConfig = {
  organizationName: 'Nilgiri Institute of Technology',
  departmentName: 'Central Equipment & Technical Facilities Directorate',
  campusName: 'Main Academic Campus & Innovation Makerspace',
  legalEntityNotice:
    'SHARESPACE is an open-source institutional resource accountability system deployed for academic and research facilities.',
  supportEmail: 'support@sharespace.internal',
  securityEmail: 'security@sharespace.internal',
  generalInquiriesEmail: 'pilot@sharespace.internal',
  officeLocation: 'Central Technical Block, Room 104, Nilgiri Institute of Technology',
  postalAddress: 'Tech Campus Road, Nilgiri District, TN 643001, India',
  phone: '+91 (0423) 220-4100 (Central Facilities Desk)',
  officeHours: 'Monday – Friday: 08:30 – 17:30 IST',
  // Flag indicating whether production owner has verified live business contacts
  isOwnerConfirmed: false,
};
