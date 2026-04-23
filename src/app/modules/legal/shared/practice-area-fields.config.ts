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
  // Adjacent sections sharing the same pairGroup render side-by-side (col-lg-6 each) on desktop
  // and stack vertically on mobile. Used e.g. to compare Defendant vs Client insurance for PIP/UIM.
  pairGroup?: string;
}

export const PRACTICE_AREA_FIELDS: { [key: string]: PracticeAreaSection[] } = {
  'Personal Injury': [
    {
      title: 'Injury Information',
      icon: 'ri-heart-pulse-line',
      fields: [
        { name: 'injuryDate', label: 'Date of Injury', type: 'date', required: true, colSize: 'col-md-4' },
        { name: 'injuryType', label: 'Accident Type', type: 'select', required: true, colSize: 'col-md-4',
          options: [
            { value: 'motor_vehicle_accident', label: 'Motor Vehicle Accident' },
            { value: 'truck_accident', label: 'Truck Accident' },
            { value: 'motorcycle_accident', label: 'Motorcycle Accident' },
            { value: 'pedestrian_accident', label: 'Pedestrian Accident' },
            { value: 'bicycle_accident', label: 'Bicycle Accident' },
            { value: 'rideshare_accident', label: 'Rideshare Accident (Uber/Lyft)' },
            { value: 'slip_and_fall', label: 'Slip and Fall' },
            { value: 'workplace_injury', label: 'Workplace Injury' },
            { value: 'construction_accident', label: 'Construction Accident' },
            { value: 'medical_malpractice', label: 'Medical Malpractice' },
            { value: 'product_liability', label: 'Product Liability' },
            { value: 'premises_liability', label: 'Premises Liability' },
            { value: 'dog_bite', label: 'Dog Bite / Animal Attack' },
            { value: 'assault', label: 'Assault / Battery' },
            { value: 'wrongful_death', label: 'Wrongful Death' },
            { value: 'other', label: 'Other' }
          ]
        },
        { name: 'accidentLocation', label: 'Accident Location', type: 'text', colSize: 'col-md-4', placeholder: 'Enter accident location' }
      ]
    },
    {
      title: "Defendant's Insurance (at-fault party)",
      icon: 'ri-shield-check-line',
      pairGroup: 'pi-insurance',
      fields: [
        // col-md-6 inside a col-lg-6 parent = 2 per row on desktop, full width on narrow screens
        { name: 'insuranceCompany', label: 'Insurance Company', type: 'text', colSize: 'col-md-6', placeholder: 'Enter defendant insurance company' },
        { name: 'insurancePolicyNumber', label: 'Policy Number', type: 'text', colSize: 'col-md-6', placeholder: 'Enter policy number' },
        { name: 'insurancePolicyLimit', label: 'Policy Limit', type: 'currency', colSize: 'col-md-6', placeholder: '0.00' },
        { name: 'insuranceAdjusterName', label: 'Adjuster Name', type: 'text', colSize: 'col-md-6', placeholder: 'Enter adjuster name' },
        { name: 'insuranceAdjusterEmail', label: 'Adjuster Email', type: 'text', colSize: 'col-md-6', placeholder: 'adjuster@example.com' },
        { name: 'insuranceAdjusterPhone', label: 'Adjuster Phone', type: 'text', colSize: 'col-md-6', placeholder: '(555) 555-5555' }
      ]
    },
    {
      title: "Client's Insurance (for PIP / UIM)",
      icon: 'ri-shield-user-line',
      pairGroup: 'pi-insurance',
      fields: [
        { name: 'clientInsuranceCompany', label: 'Client Insurance Company', type: 'text', colSize: 'col-md-6', placeholder: "Enter client's insurer" },
        { name: 'clientInsurancePolicyNumber', label: 'Client Policy Number', type: 'text', colSize: 'col-md-6', placeholder: 'Enter policy number' },
        { name: 'clientInsuranceAdjusterName', label: 'Client Adjuster Name', type: 'text', colSize: 'col-md-6', placeholder: 'Enter adjuster name' },
        { name: 'clientInsuranceAdjusterEmail', label: 'Client Adjuster Email', type: 'text', colSize: 'col-md-6', placeholder: 'adjuster@example.com' },
        { name: 'clientInsuranceAdjusterPhone', label: 'Client Adjuster Phone', type: 'text', colSize: 'col-md-6', placeholder: '(555) 555-5555' }
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
        { name: 'primaryCharge', label: 'Charge', type: 'text', required: true, colSize: 'col-md-6', placeholder: 'e.g. DWI - 2nd Offense' },
        { name: 'chargeLevel', label: 'Severity', type: 'select', required: true, colSize: 'col-md-3',
          options: [
            { value: 'felony', label: 'Felony' },
            { value: 'misdemeanor', label: 'Misdemeanor' },
            { value: 'infraction', label: 'Infraction / Violation' },
            { value: 'federal', label: 'Federal Offense' }
          ]
        },
        { name: 'chargeDegree', label: 'Degree / Class', type: 'text', colSize: 'col-md-3', placeholder: 'e.g. Class A, 2nd Degree' },
        { name: 'statuteReference', label: 'Statute', type: 'text', colSize: 'col-md-6', placeholder: 'e.g. Penal Code § 49.04' },
        { name: 'additionalCharges', label: 'Additional Charges / Counts', type: 'textarea', colSize: 'col-md-6', placeholder: 'List any additional charges with severity and statute, one per line' }
      ]
    },
    {
      title: 'Arrest & Court Details',
      icon: 'ri-building-line',
      fields: [
        { name: 'arrestDate', label: 'Arrest Date', type: 'date', required: true, colSize: 'col-md-4' },
        { name: 'docketNumber', label: 'Cause / Docket Number', type: 'text', colSize: 'col-md-4', placeholder: 'Enter cause number' },
        { name: 'prosecutorName', label: 'Prosecutor / ADA', type: 'text', colSize: 'col-md-4', placeholder: 'Enter prosecutor name' },
        { name: 'custodyStatus', label: 'Custody Status', type: 'select', colSize: 'col-md-4',
          options: [
            { value: 'in_custody', label: 'In Custody' },
            { value: 'released_bond', label: 'Released on Bond' },
            { value: 'pr_bond', label: 'Personal Recognizance (PR Bond)' },
            { value: 'pending_bond', label: 'Pending Bond' }
          ]
        },
        { name: 'bailAmount', label: 'Bond Amount', type: 'currency', colSize: 'col-md-4', placeholder: '0.00' },
        { name: 'priorRecord', label: 'Prior Criminal History', type: 'select', colSize: 'col-md-4',
          options: [
            { value: 'none', label: 'No Prior Record' },
            { value: 'misdemeanor_only', label: 'Prior Misdemeanor(s)' },
            { value: 'felony', label: 'Prior Felony Conviction(s)' },
            { value: 'unknown', label: 'Unknown / To Be Determined' }
          ]
        }
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

  'Immigration': [
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

  'Real Estate': [
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

// Type to Practice Area mapping for cases that don't have practiceArea set
// Maps both legacy enum values AND type names that match practice areas
export const TYPE_TO_PRACTICE_AREA: { [key: string]: string } = {
  // Legacy enum mappings
  'CIVIL': 'Personal Injury',
  'CRIMINAL': 'Criminal Defense',
  'FAMILY': 'Family Law',
  'IMMIGRATION': 'Immigration',
  'REAL_ESTATE': 'Real Estate',
  'INTELLECTUAL_PROPERTY': 'Intellectual Property',

  // Direct type name mappings (when type matches practice area name)
  'Personal Injury': 'Personal Injury',
  'Criminal Defense': 'Criminal Defense',
  'Family Law': 'Family Law',
  'Immigration': 'Immigration',
  'Immigration Law': 'Immigration',
  'Real Estate': 'Real Estate',
  'Real Estate Law': 'Real Estate',
  'Intellectual Property': 'Intellectual Property',

  // Related case types that map to practice areas
  'Medical Malpractice': 'Personal Injury',
  'MEDICAL_MALPRACTICE': 'Personal Injury',
  'Auto Accident': 'Personal Injury',
  'Wrongful Death': 'Personal Injury',
  'Slip and Fall': 'Personal Injury',
  'Product Liability': 'Personal Injury'
};

/**
 * Collapse a flat section list into an array of rows.
 * Adjacent sections with the same `pairGroup` become a single row (rendered col-lg-6 each);
 * every other section becomes a row of one (col-12). Order is preserved.
 */
export function groupPracticeAreaSections(sections: PracticeAreaSection[]): PracticeAreaSection[][] {
  const rows: PracticeAreaSection[][] = [];
  let i = 0;
  while (i < sections.length) {
    const s = sections[i];
    if (s.pairGroup) {
      const group: PracticeAreaSection[] = [s];
      let j = i + 1;
      while (j < sections.length && sections[j].pairGroup === s.pairGroup) {
        group.push(sections[j]);
        j++;
      }
      rows.push(group);
      i = j;
    } else {
      rows.push([s]);
      i++;
    }
  }
  return rows;
}
