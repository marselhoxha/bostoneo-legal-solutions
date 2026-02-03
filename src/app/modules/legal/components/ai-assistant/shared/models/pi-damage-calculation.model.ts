/**
 * PI Damage Calculation Models
 * Represents damage elements and overall calculation summary
 */

export interface PIDamageElement {
  id?: number;
  caseId: number;
  organizationId?: number;

  // Damage Category
  elementType: string;
  elementName: string;

  // Calculation Details
  calculationMethod?: string;
  baseAmount?: number;
  multiplier?: number;
  durationValue?: number;
  durationUnit?: string;
  calculatedAmount: number;

  // Confidence & Documentation
  confidenceLevel?: string;
  confidenceNotes?: string;
  supportingDocuments?: string[];

  // Source Information
  sourceProvider?: string;
  sourceEmployer?: string;
  sourceDate?: string;

  // Notes
  notes?: string;
  legalAuthority?: string;

  // Display Order
  displayOrder?: number;

  // Related info
  caseNumber?: string;
  clientName?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
  createdByName?: string;
}

export interface PIDamageCalculation {
  id?: number;
  caseId: number;
  organizationId?: number;

  // Damage Totals by Category
  pastMedicalTotal?: number;
  futureMedicalTotal?: number;
  lostWagesTotal?: number;
  earningCapacityTotal?: number;
  householdServicesTotal?: number;
  painSufferingTotal?: number;
  mileageTotal?: number;
  otherDamagesTotal?: number;

  // Summary Amounts
  economicDamagesTotal?: number;
  nonEconomicDamagesTotal?: number;
  grossDamagesTotal?: number;

  // Adjustments
  comparativeNegligencePercent?: number;
  adjustedDamagesTotal?: number;

  // Value Range
  lowValue?: number;
  midValue?: number;
  highValue?: number;

  // AI Comparable Analysis
  comparableAnalysis?: {
    success: boolean;
    analysis?: string;
    injuryType?: string;
    jurisdiction?: string;
    generatedAt?: string;
    error?: string;
  };

  // AI Settlement Analysis (from case value calculation)
  settlementAnalysis?: {
    economicDamages?: number;
    nonEconomicDamages?: number;
    totalCaseValue?: number;
    realisticRecovery?: number;
    settlementRangeLow?: number;
    settlementRangeHigh?: number;
    caseStrength?: number;
    recommendedMultiplier?: number;
    multiplierReasoning?: string;
    keyFactors?: string[];
    recommendations?: string;
    medicalToLimitRatio?: number;
    isUnderinsured?: boolean;
    generatedAt?: string;
  };

  // Calculation Info
  calculatedAt?: string;
  calculationNotes?: string;

  // Related info
  caseNumber?: string;
  clientName?: string;
  injuryType?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export const DAMAGE_ELEMENT_TYPES = [
  { value: 'PAST_MEDICAL', label: 'Past Medical Expenses', category: 'economic', icon: 'ri-hospital-line' },
  { value: 'FUTURE_MEDICAL', label: 'Future Medical Care', category: 'economic', icon: 'ri-calendar-todo-line' },
  { value: 'LOST_WAGES', label: 'Lost Wages', category: 'economic', icon: 'ri-money-dollar-circle-line' },
  { value: 'EARNING_CAPACITY', label: 'Loss of Earning Capacity', category: 'economic', icon: 'ri-line-chart-line' },
  { value: 'HOUSEHOLD_SERVICES', label: 'Household Services', category: 'economic', icon: 'ri-home-line' },
  { value: 'MILEAGE', label: 'Mileage/Transportation', category: 'economic', icon: 'ri-car-line' },
  { value: 'PAIN_SUFFERING', label: 'Pain & Suffering', category: 'non-economic', icon: 'ri-heart-pulse-line' },
  { value: 'OTHER', label: 'Other Damages', category: 'economic', icon: 'ri-file-list-line' }
];

export const CALCULATION_METHODS = [
  { value: 'ACTUAL', label: 'Actual Amount' },
  { value: 'MULTIPLIER', label: 'Multiplier Method' },
  { value: 'PER_DIEM', label: 'Per Diem Method' },
  { value: 'PROJECTION', label: 'Future Projection' },
  { value: 'HOURLY', label: 'Hourly Rate' },
  { value: 'MONTHLY', label: 'Monthly Rate' }
];

export const CONFIDENCE_LEVELS = [
  { value: 'HIGH', label: 'High', color: 'success' },
  { value: 'MEDIUM', label: 'Medium', color: 'warning' },
  { value: 'LOW', label: 'Low', color: 'danger' }
];

// IRS Mileage Rate for 2024
export const IRS_MILEAGE_RATE = 0.67;
