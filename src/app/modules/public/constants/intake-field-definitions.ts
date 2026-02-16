export interface IntakeField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select' | 'radio';
  required: boolean;
  options?: any[];
  rows?: number;
  fullWidth?: boolean;
  defaultValue?: string;
  placeholder?: string;
}

export const INTAKE_FIELD_DEFINITIONS: { [practiceArea: string]: IntakeField[] } = {
  'Personal Injury': [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'email', label: 'Email Address', type: 'email', required: true },
    { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
    { name: 'incidentDate', label: 'Date of Incident', type: 'date', required: true },
    { name: 'incidentLocation', label: 'Location of Incident', type: 'text', required: true },
    { name: 'injuryType', label: 'Type of Injury', type: 'select', required: true,
      options: ['Motor Vehicle Accident', 'Slip and Fall', 'Medical Malpractice', 'Product Liability', 'Other'] },
    { name: 'medicalTreatment', label: 'Did you receive medical treatment?', type: 'radio', required: true,
      options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { name: 'description', label: 'Describe the incident and injuries', type: 'textarea', required: true, rows: 4 },
    { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
      options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
  ],
  'Family Law': [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'email', label: 'Email Address', type: 'email', required: true },
    { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
    { name: 'caseType', label: 'Type of Case', type: 'select', required: true,
      options: ['Divorce', 'Child Custody', 'Child Support', 'Adoption', 'Domestic Violence', 'Prenuptial Agreement', 'Other'] },
    { name: 'maritalStatus', label: 'Current Marital Status', type: 'select', required: true,
      options: ['Married', 'Separated', 'Divorced', 'Single', 'Widowed'] },
    { name: 'hasChildren', label: 'Do you have children?', type: 'radio', required: true,
      options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { name: 'childrenAges', label: 'Ages of children (if applicable)', type: 'text', required: false },
    { name: 'description', label: 'Describe your legal matter', type: 'textarea', required: true, rows: 4 },
    { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
      options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
  ],
  'Criminal Defense': [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'email', label: 'Email Address', type: 'email', required: true },
    { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
    { name: 'chargeType', label: 'Type of Charges', type: 'select', required: true,
      options: ['DUI/DWI', 'Drug Charges', 'Theft', 'Assault', 'Fraud', 'Traffic Violations', 'Other'] },
    { name: 'courtDate', label: 'Next Court Date (if known)', type: 'date', required: false },
    { name: 'arrestDate', label: 'Date of Arrest', type: 'date', required: false },
    { name: 'location', label: 'Location of Incident', type: 'text', required: false },
    { name: 'isIncarcerated', label: 'Are you currently in custody?', type: 'radio', required: true,
      options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { name: 'description', label: 'Describe the charges and circumstances', type: 'textarea', required: true, rows: 4 },
    { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
      options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
  ],
  'Business Law': [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'email', label: 'Email Address', type: 'email', required: true },
    { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
    { name: 'company', label: 'Company/Business Name', type: 'text', required: false },
    { name: 'businessType', label: 'Type of Business Matter', type: 'select', required: true,
      options: ['Contract Dispute', 'Business Formation', 'Employment Law', 'Intellectual Property', 'Mergers & Acquisitions', 'Compliance', 'Other'] },
    { name: 'industry', label: 'Industry', type: 'text', required: false },
    { name: 'businessSize', label: 'Number of Employees', type: 'select', required: false,
      options: ['1-10', '11-50', '51-200', '201-1000', '1000+'] },
    { name: 'description', label: 'Describe your business legal matter', type: 'textarea', required: true, rows: 4 },
    { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
      options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
  ],
  'Real Estate Law': [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'email', label: 'Email Address', type: 'email', required: true },
    { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
    { name: 'propertyType', label: 'Type of Property', type: 'select', required: true,
      options: ['Residential', 'Commercial', 'Industrial', 'Land/Vacant'] },
    { name: 'transactionType', label: 'Type of Transaction', type: 'select', required: true,
      options: ['Purchase', 'Sale', 'Lease', 'Refinancing', 'Dispute', 'Title Issue', 'Other'] },
    { name: 'propertyAddress', label: 'Property Address', type: 'text', required: false },
    { name: 'propertyValue', label: 'Estimated Property Value', type: 'select', required: false,
      options: ['Under $100K', '$100K - $250K', '$250K - $500K', '$500K - $1M', 'Over $1M'] },
    { name: 'timeline', label: 'Expected Timeline', type: 'select', required: false,
      options: ['Within 30 days', '1-3 months', '3-6 months', '6+ months', 'No specific timeline'] },
    { name: 'description', label: 'Describe your real estate matter', type: 'textarea', required: true, rows: 4 },
    { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
      options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
  ],
  'Immigration Law': [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'email', label: 'Email Address', type: 'email', required: true },
    { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
    { name: 'countryOfOrigin', label: 'Country of Origin', type: 'text', required: true },
    { name: 'currentStatus', label: 'Current Immigration Status', type: 'select', required: true,
      options: ['US Citizen', 'Permanent Resident', 'Work Visa', 'Student Visa', 'Tourist/Visitor', 'Asylum Seeker', 'Undocumented', 'Other'] },
    { name: 'caseType', label: 'Type of Immigration Matter', type: 'select', required: true,
      options: ['Green Card/Permanent Residency', 'Citizenship/Naturalization', 'Work Visa', 'Family Visa', 'Asylum/Refugee', 'Deportation Defense', 'Other'] },
    { name: 'familyInUS', label: 'Do you have family members in the US?', type: 'radio', required: true,
      options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { name: 'hasDeadline', label: 'Do you have any upcoming immigration deadlines?', type: 'radio', required: true,
      options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { name: 'description', label: 'Describe your immigration situation', type: 'textarea', required: true, rows: 4 },
    { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
      options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
  ]
};
