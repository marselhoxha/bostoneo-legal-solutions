export interface PracticeAreaField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'currency' | 'number' | 'checkbox' | 'textarea';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  colSize?: string;
}

export interface PracticeAreaSection {
  title: string;
  icon?: string;
  fields: PracticeAreaField[];
}

export const PRACTICE_AREA_FIELDS: { [key: string]: PracticeAreaSection[] } = {
  'Personal Injury': [
    {
      title: 'Injury Information',
      icon: 'ri-heart-pulse-line',
      fields: [
        { name: 'injuryDate', label: 'Date of Injury', type: 'date', required: true, colSize: 'col-md-4' },
        { name: 'injuryType', label: 'Injury Type', type: 'select', required: true, colSize: 'col-md-4',
          options: [
            { value: 'soft_tissue', label: 'Soft Tissue' },
            { value: 'tbi', label: 'Traumatic Brain Injury' },
            { value: 'spinal', label: 'Spinal Injury' },
            { value: 'fracture', label: 'Fracture' },
            { value: 'burn', label: 'Burn' },
            { value: 'other', label: 'Other' }
          ]
        },
        { name: 'accidentLocation', label: 'Accident Location', type: 'text', colSize: 'col-md-4', placeholder: 'Enter accident location' }
      ]
    },
    {
      title: 'Insurance Information',
      icon: 'ri-shield-check-line',
      fields: [
        { name: 'insuranceCompany', label: 'Insurance Company', type: 'text', colSize: 'col-md-4', placeholder: 'Enter insurance company' },
        { name: 'insurancePolicyNumber', label: 'Policy Number', type: 'text', colSize: 'col-md-4', placeholder: 'Enter policy number' },
        { name: 'insurancePolicyLimit', label: 'Policy Limit', type: 'currency', colSize: 'col-md-4', placeholder: '0.00' }
      ]
    },
    {
      title: 'Defendant Information',
      icon: 'ri-user-line',
      fields: [
        { name: 'defendantName', label: 'Defendant Name', type: 'text', colSize: 'col-md-6', placeholder: 'Enter defendant name' },
        { name: 'defendantAddress', label: 'Defendant Address', type: 'text', colSize: 'col-md-6', placeholder: 'Enter defendant address' }
      ]
    }
  ],

  'Criminal Defense': [
    {
      title: 'Charge Information',
      icon: 'ri-scales-3-line',
      fields: [
        { name: 'primaryCharge', label: 'Primary Charge', type: 'text', required: true, colSize: 'col-md-6', placeholder: 'Enter primary charge' },
        { name: 'chargeLevel', label: 'Charge Level', type: 'select', required: true, colSize: 'col-md-6',
          options: [
            { value: 'FELONY', label: 'Felony' },
            { value: 'MISDEMEANOR', label: 'Misdemeanor' },
            { value: 'VIOLATION', label: 'Violation' },
            { value: 'INFRACTION', label: 'Infraction' }
          ]
        },
        { name: 'docketNumber', label: 'Docket Number', type: 'text', colSize: 'col-md-4', placeholder: 'Enter docket number' },
        { name: 'arrestDate', label: 'Arrest Date', type: 'date', colSize: 'col-md-4' },
        { name: 'prosecutorName', label: 'Prosecutor Name', type: 'text', colSize: 'col-md-4', placeholder: 'Enter prosecutor name' }
      ]
    },
    {
      title: 'Bail Information',
      icon: 'ri-money-dollar-circle-line',
      fields: [
        { name: 'bailAmount', label: 'Bail Amount', type: 'currency', colSize: 'col-md-6', placeholder: '0.00' }
      ]
    }
  ],

  'Family Law': [
    {
      title: 'Case Details',
      icon: 'ri-group-line',
      fields: [
        { name: 'caseSubtype', label: 'Case Type', type: 'select', required: true, colSize: 'col-md-4',
          options: [
            { value: 'DIVORCE', label: 'Divorce' },
            { value: 'CUSTODY', label: 'Child Custody' },
            { value: 'CHILD_SUPPORT', label: 'Child Support' },
            { value: 'ALIMONY', label: 'Alimony/Spousal Support' },
            { value: 'ADOPTION', label: 'Adoption' },
            { value: 'PATERNITY', label: 'Paternity' },
            { value: 'OTHER', label: 'Other' }
          ]
        },
        { name: 'spouseName', label: 'Spouse/Other Party Name', type: 'text', colSize: 'col-md-4', placeholder: 'Enter spouse/other party name' },
        { name: 'marriageDate', label: 'Marriage Date', type: 'date', colSize: 'col-md-4' }
      ]
    },
    {
      title: 'Children Information',
      icon: 'ri-parent-line',
      fields: [
        { name: 'hasMinorChildren', label: 'Minor Children Involved?', type: 'checkbox', colSize: 'col-md-4' },
        { name: 'childrenCount', label: 'Number of Children', type: 'number', colSize: 'col-md-4', placeholder: '0' },
        { name: 'custodyArrangement', label: 'Desired Custody', type: 'select', colSize: 'col-md-4',
          options: [
            { value: 'SOLE', label: 'Sole Custody' },
            { value: 'JOINT', label: 'Joint Custody' },
            { value: 'SHARED', label: 'Shared Parenting' },
            { value: 'UNDETERMINED', label: 'To Be Determined' }
          ]
        }
      ]
    }
  ],

  'Immigration Law': [
    {
      title: 'Case Information',
      icon: 'ri-global-line',
      fields: [
        { name: 'formType', label: 'Form Type', type: 'select', required: true, colSize: 'col-md-4',
          options: [
            { value: 'I-130', label: 'I-130 (Family Petition)' },
            { value: 'I-140', label: 'I-140 (Employment Petition)' },
            { value: 'I-485', label: 'I-485 (Adjustment of Status)' },
            { value: 'I-765', label: 'I-765 (Work Permit)' },
            { value: 'I-131', label: 'I-131 (Travel Document)' },
            { value: 'N-400', label: 'N-400 (Naturalization)' },
            { value: 'OTHER', label: 'Other' }
          ]
        },
        { name: 'uscisNumber', label: 'USCIS/Receipt Number', type: 'text', colSize: 'col-md-4', placeholder: 'Enter USCIS number' },
        { name: 'visaCategory', label: 'Visa Category', type: 'text', colSize: 'col-md-4', placeholder: 'Enter visa category' }
      ]
    },
    {
      title: 'Parties',
      icon: 'ri-user-star-line',
      fields: [
        { name: 'petitionerName', label: 'Petitioner Name', type: 'text', required: true, colSize: 'col-md-6', placeholder: 'Enter petitioner name' },
        { name: 'beneficiaryName', label: 'Beneficiary Name', type: 'text', colSize: 'col-md-6', placeholder: 'Enter beneficiary name' },
        { name: 'priorityDate', label: 'Priority Date', type: 'date', colSize: 'col-md-6' }
      ]
    }
  ],

  'Real Estate Law': [
    {
      title: 'Transaction Details',
      icon: 'ri-home-4-line',
      fields: [
        { name: 'transactionType', label: 'Transaction Type', type: 'select', required: true, colSize: 'col-md-4',
          options: [
            { value: 'PURCHASE', label: 'Purchase' },
            { value: 'SALE', label: 'Sale' },
            { value: 'LEASE', label: 'Lease' },
            { value: 'REFINANCE', label: 'Refinance' },
            { value: 'TITLE_REVIEW', label: 'Title Review' },
            { value: 'OTHER', label: 'Other' }
          ]
        },
        { name: 'propertyAddress', label: 'Property Address', type: 'textarea', required: true, colSize: 'col-md-8', placeholder: 'Enter property address' }
      ]
    },
    {
      title: 'Financial & Parties',
      icon: 'ri-money-dollar-box-line',
      fields: [
        { name: 'purchasePrice', label: 'Purchase Price', type: 'currency', colSize: 'col-md-4', placeholder: '0.00' },
        { name: 'closingDate', label: 'Closing Date', type: 'date', colSize: 'col-md-4' },
        { name: 'buyerName', label: 'Buyer Name', type: 'text', colSize: 'col-md-6', placeholder: 'Enter buyer name' },
        { name: 'sellerName', label: 'Seller Name', type: 'text', colSize: 'col-md-6', placeholder: 'Enter seller name' }
      ]
    }
  ],

  'Intellectual Property': [
    {
      title: 'IP Details',
      icon: 'ri-lightbulb-line',
      fields: [
        { name: 'ipType', label: 'IP Type', type: 'select', required: true, colSize: 'col-md-4',
          options: [
            { value: 'PATENT', label: 'Patent' },
            { value: 'TRADEMARK', label: 'Trademark' },
            { value: 'COPYRIGHT', label: 'Copyright' },
            { value: 'TRADE_SECRET', label: 'Trade Secret' },
            { value: 'OTHER', label: 'Other' }
          ]
        },
        { name: 'applicationNumber', label: 'Application/Registration Number', type: 'text', colSize: 'col-md-4', placeholder: 'Enter application number' },
        { name: 'ipFilingDate', label: 'Filing Date', type: 'date', colSize: 'col-md-4' }
      ]
    },
    {
      title: 'Additional Information',
      icon: 'ri-user-settings-line',
      fields: [
        { name: 'inventorName', label: 'Inventor/Creator Name', type: 'text', colSize: 'col-md-6', placeholder: 'Enter inventor/creator name' },
        { name: 'technologyArea', label: 'Technology/Subject Area', type: 'text', colSize: 'col-md-6', placeholder: 'Enter technology/subject area' }
      ]
    }
  ]
};
