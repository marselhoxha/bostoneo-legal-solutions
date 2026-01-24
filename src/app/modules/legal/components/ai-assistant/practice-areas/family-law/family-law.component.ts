import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PracticeAreaBaseComponent } from '../../shared/practice-area-base.component';
import { AiResponseFormatterPipe } from '../../shared/ai-response-formatter.pipe';
import { AiResponseModalService } from '../../shared/services/ai-response-modal.service';
import { environment } from '../../../../../../../environments/environment';

interface CustodySchedule {
  weekdays: string;
  weekends: string;
  holidays: string;
  summerBreak: string;
}

interface PropertyAsset {
  id: string;
  type: string;
  description: string;
  value: number;
  ownership: string;
  proposed: string;
}

@Component({
  selector: 'app-family-law',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, AiResponseFormatterPipe],
  templateUrl: './family-law.component.html',
  styleUrls: ['./family-law.component.scss']
})
export class FamilyLawComponent extends PracticeAreaBaseComponent implements OnInit {
  activeTab: string = 'child-support';
  
  // Child Support Calculator
  childSupportForm: FormGroup;
  calculatedSupport: any = null;
  isCalculatingSupport: boolean = false;
  
  // Custody Agreement Generator
  custodyForm: FormGroup;
  generatedCustody: string = '';
  isGeneratingCustody: boolean = false;
  custodyTypes = [
    { value: 'joint-legal', label: 'Joint Legal Custody' },
    { value: 'sole-legal', label: 'Sole Legal Custody' },
    { value: 'joint-physical', label: 'Joint Physical Custody' },
    { value: 'sole-physical', label: 'Sole Physical Custody' }
  ];
  
  // Divorce Document Preparation
  divorceForm: FormGroup;
  divorceDocuments: any[] = [];
  isPreparingDocuments: boolean = false;
  divorceTypes = [
    { value: 'uncontested', label: 'Uncontested (1A)' },
    { value: 'contested', label: 'Contested (1B)' },
    { value: 'no-fault', label: 'No-Fault' },
    { value: 'fault', label: 'Fault-Based' }
  ];
  
  // Property Division Analyzer
  propertyAssets: PropertyAsset[] = [];
  isAnalyzingProperty: boolean = false;
  newAsset: PropertyAsset = {
    id: '',
    type: 'real-estate',
    description: '',
    value: 0,
    ownership: 'joint',
    proposed: 'plaintiff'
  };
  propertyAnalysis: any = null;
  
  // Alimony Calculator
  alimonyForm: FormGroup;
  calculatedAlimony: any = null;
  isCalculatingAlimony: boolean = false;
  alimonyTypes = [
    { value: 'general', label: 'General Term Alimony' },
    { value: 'rehabilitative', label: 'Rehabilitative Alimony' },
    { value: 'reimbursement', label: 'Reimbursement Alimony' },
    { value: 'transitional', label: 'Transitional Alimony' }
  ];
  
  // Massachusetts specific guidelines
  maGuidelines = {
    childSupport: {
      percentages: {
        one: 0.17,
        two: 0.25,
        three: 0.29,
        four: 0.31,
        five: 0.34
      },
      maxIncome: 250000
    },
    alimony: {
      percentage: 0.35,
      durationFactors: {
        under5: 0.5,
        under10: 0.6,
        under15: 0.7,
        under20: 0.8,
        over20: 'indefinite'
      }
    }
  };
  
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private aiModalService: AiResponseModalService
  ) {
    super();
    // Initialize Child Support Form
    this.childSupportForm = this.fb.group({
      payorIncome: [0, [Validators.required, Validators.min(0)]],
      payeeIncome: [0, [Validators.required, Validators.min(0)]],
      numberOfChildren: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
      healthInsurance: [0, [Validators.required, Validators.min(0)]],
      childcare: [0, [Validators.required, Validators.min(0)]],
      otherDeductions: [0, [Validators.min(0)]],
      parentsShareCustody: [false],
      overnightsWithPayor: [0, [Validators.min(0), Validators.max(365)]]
    });

    // Initialize Custody Form
    this.custodyForm = this.fb.group({
      legalCustody: ['joint-legal', Validators.required],
      physicalCustody: ['joint-physical', Validators.required],
      parentAName: ['', Validators.required],
      parentBName: ['', Validators.required],
      childrenNames: ['', Validators.required],
      schoolDistrict: ['', Validators.required],
      holidaySchedule: ['alternating', Validators.required],
      vacationTime: ['2weeks', Validators.required],
      decisionMaking: this.fb.group({
        education: ['joint'],
        medical: ['joint'],
        extracurricular: ['joint'],
        religious: ['joint']
      }),
      disputeResolution: ['mediation', Validators.required],
      relocationNotice: [60, [Validators.required, Validators.min(30)]]
    });

    // Initialize Divorce Form
    this.divorceForm = this.fb.group({
      divorceType: ['', Validators.required],
      plaintiffName: ['', Validators.required],
      defendantName: ['', Validators.required],
      marriageDate: ['', Validators.required],
      separationDate: ['', Validators.required],
      grounds: [''],
      hasChildren: [false],
      hasProperty: [false],
      seekingAlimony: [false],
      county: ['', Validators.required],
      irretrievableBreakdown: [false]
    });

    // Initialize Alimony Form
    this.alimonyForm = this.fb.group({
      alimonyType: ['general', Validators.required],
      payorIncome: [0, [Validators.required, Validators.min(0)]],
      recipientIncome: [0, [Validators.required, Validators.min(0)]],
      marriageLength: [0, [Validators.required, Validators.min(0)]],
      payorAge: [0, [Validators.required, Validators.min(18)]],
      recipientAge: [0, [Validators.required, Validators.min(18)]],
      recipientNeed: ['', Validators.required],
      payorAbilityToPay: ['', Validators.required],
      standardOfLiving: ['', Validators.required],
      healthConditions: [''],
      contributions: ['']
    });
  }

  ngOnInit(): void {
    this.loadSavedData();
  }

  loadSavedData(): void {
    // Load saved property assets
    const savedAssets = localStorage.getItem('familyLaw_assets');
    if (savedAssets) {
      this.propertyAssets = JSON.parse(savedAssets);
    }
  }

  // Tab Navigation
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Child Support Calculator Methods
  calculateChildSupport(): void {
    if (this.childSupportForm.invalid) {
      this.markFormGroupTouched(this.childSupportForm);
      return;
    }

    this.isCalculatingSupport = true;
    const formData = this.childSupportForm.value;
    
    this.http.post<any>('${environment.apiUrl}/api/ai/family-law/calculate-child-support', formData)
      .subscribe({
        next: (response) => {
          if (response.success && response.calculation) {
            // Parse AI response for calculation details
            this.calculatedSupport = {
              weeklyAmount: 0,
              monthlyAmount: 0,
              yearlyAmount: 0,
              payorShare: 0,
              effectiveDate: new Date().toLocaleDateString(),
              guidelines: 'Massachusetts Child Support Guidelines',
              deviationFactors: []
            };

            // Try to extract amounts from response if structured
            this.parseChildSupportCalculation(response.calculation);

            // Open modal with AI calculation
            const contextInfo = {
              'Custodial Parent Income': `$${formData.custodialIncome?.toLocaleString() || 0}`,
              'Non-Custodial Parent Income': `$${formData.nonCustodialIncome?.toLocaleString() || 0}`,
              'Number of Children': formData.numberOfChildren || 0,
              'Healthcare Costs': `$${formData.healthcareCosts?.toLocaleString() || 0}`,
              'Childcare Costs': `$${formData.childcareCosts?.toLocaleString() || 0}`
            };
            this.aiModalService.openChildSupportCalculation(response.calculation, contextInfo);
          } else {
            console.error('Calculation failed:', response.error);
          }
          this.isCalculatingSupport = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error calculating child support:', error);
          this.isCalculatingSupport = false;
          this.cdr.detectChanges();
        }
      });
  }

  private parseChildSupportCalculation(calculation: string): void {
    // Try to extract amounts from AI response
    const weeklyMatch = calculation.match(/weekly[\s:]+\$?([\d,]+)/i);
    const monthlyMatch = calculation.match(/monthly[\s:]+\$?([\d,]+)/i);
    const yearlyMatch = calculation.match(/annual|yearly[\s:]+\$?([\d,]+)/i);
    
    if (weeklyMatch) {
      this.calculatedSupport.weeklyAmount = parseInt(weeklyMatch[1].replace(/,/g, ''));
    }
    if (monthlyMatch) {
      this.calculatedSupport.monthlyAmount = parseInt(monthlyMatch[1].replace(/,/g, ''));
    }
    if (yearlyMatch) {
      this.calculatedSupport.yearlyAmount = parseInt(yearlyMatch[1].replace(/,/g, ''));
    }
  }

  private getChildCountKey(count: number): string {
    const keys = ['one', 'two', 'three', 'four', 'five'];
    return keys[Math.min(count - 1, 4)];
  }

  private getDeviationFactors(data: any): string[] {
    const factors = [];
    if (data.overnightsWithPayor > 104) {
      factors.push('Shared parenting time adjustment applied');
    }
    if (data.payorIncome > this.maGuidelines.childSupport.maxIncome) {
      factors.push('Income above guideline cap');
    }
    if (data.otherDeductions > 0) {
      factors.push('Other court-ordered obligations considered');
    }
    return factors;
  }

  // Custody Agreement Generator Methods
  generateCustodyAgreement(): void {
    if (this.custodyForm.invalid) {
      this.markFormGroupTouched(this.custodyForm);
      return;
    }

    this.isGeneratingCustody = true;
    const formData = this.custodyForm.value;
    
    this.http.post<any>('${environment.apiUrl}/api/ai/family-law/generate-custody-agreement', formData)
      .subscribe({
        next: (response) => {
          if (response.success && response.agreement) {
            this.generatedCustody = response.agreement;

            // Open modal with custody agreement
            const contextInfo = {
              'Custody Type': formData.custodyType,
              'Parent 1': formData.parent1Name,
              'Parent 2': formData.parent2Name,
              'Children Names': formData.childrenNames,
              'Effective Date': formData.effectiveDate
            };
            this.aiModalService.openCustodyAgreement(response.agreement, contextInfo);
          } else {
            this.generatedCustody = 'Error generating custody agreement. Please try again.';
          }
          this.isGeneratingCustody = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error generating custody agreement:', error);
          this.generatedCustody = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingCustody = false;
          this.cdr.detectChanges();
        }
      });
  }

  private createCustodyAgreement(data: any): string {
    const legalCustodyText = data.legalCustody === 'joint-legal' 
      ? `The parties shall share joint legal custody of the minor child(ren)`
      : `${data.legalCustody === 'sole-legal' ? data.parentAName : data.parentBName} shall have sole legal custody`;
    
    const physicalCustodyText = data.physicalCustody === 'joint-physical'
      ? `The parties shall share joint physical custody with a substantially equal parenting schedule`
      : `${data.physicalCustody === 'sole-physical' ? data.parentAName : data.parentBName} shall have primary physical custody`;

    return `
PARENTING PLAN AND CUSTODY AGREEMENT

This Agreement is entered into between ${data.parentAName} ("Parent A") and ${data.parentBName} ("Parent B") concerning the following minor child(ren): ${data.childrenNames}.

I. LEGAL CUSTODY
${legalCustodyText}, with major decisions regarding education, medical care, and religious upbringing to be made as follows:
- Educational decisions: ${data.decisionMaking.education}
- Medical decisions: ${data.decisionMaking.medical}
- Extracurricular activities: ${data.decisionMaking.extracurricular}
- Religious upbringing: ${data.decisionMaking.religious}

II. PHYSICAL CUSTODY
${physicalCustodyText}.

III. PARENTING TIME SCHEDULE
Regular Schedule:
- School Year: [Detailed weekly schedule]
- Summer Break: Each parent shall have ${data.vacationTime} of uninterrupted vacation time
- Holidays: ${data.holidaySchedule === 'alternating' ? 'Holidays shall be alternated annually' : 'Holidays shall be divided as specified'}

IV. SCHOOL DISTRICT
The child(ren) shall attend school in the ${data.schoolDistrict} school district.

V. DISPUTE RESOLUTION
Any disputes arising under this Agreement shall first be submitted to ${data.disputeResolution} before seeking court intervention.

VI. RELOCATION
Either party intending to relocate must provide ${data.relocationNotice} days written notice to the other party.

VII. MODIFICATION
This Agreement may only be modified by written consent of both parties or by court order.

Dated: ${new Date().toLocaleDateString()}

_______________________     _______________________
${data.parentAName}          ${data.parentBName}
Parent A                     Parent B
    `.trim();
  }

  // Divorce Document Preparation Methods
  prepareDivorceDocuments(): void {
    if (this.divorceForm.invalid) {
      this.markFormGroupTouched(this.divorceForm);
      return;
    }

    this.isPreparingDocuments = true;
    const formData = this.divorceForm.value;
    
    this.http.post<any>('${environment.apiUrl}/api/ai/family-law/prepare-divorce-documents', formData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Parse AI response and generate document list
            this.divorceDocuments = this.generateDivorceDocumentsList(formData);
            // Add AI-generated documents note
            if (response.documents) {
              this.divorceDocuments.push({
                name: 'AI-Generated Documents Package',
                required: false,
                status: 'ready'
              });

              // Open modal with divorce documents information
              const contextInfo = {
                'Divorce Type': formData.divorceType,
                'Plaintiff': formData.plaintiffName,
                'Defendant': formData.defendantName,
                'Marriage Date': formData.marriageDate,
                'Children': formData.hasMinorChildren ? 'Yes' : 'No'
              };
              this.aiModalService.openDivorceDocument(response.documents, contextInfo);
            }
          } else {
            this.divorceDocuments = this.generateDivorceDocumentsList(formData);
          }
          this.isPreparingDocuments = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error preparing divorce documents:', error);
          this.divorceDocuments = this.generateDivorceDocumentsList(formData);
          this.isPreparingDocuments = false;
          this.cdr.detectChanges();
        }
      });
  }

  private generateDivorceDocumentsList(data: any): any[] {
    const documents = [];
    
    // Base documents for all divorces
    documents.push(
      { name: 'Complaint for Divorce', required: true, status: 'ready' },
      { name: 'Summons', required: true, status: 'ready' },
      { name: 'Vital Statistics Form', required: true, status: 'ready' }
    );
    
    if (data.divorceType === 'uncontested') {
      documents.push(
        { name: 'Joint Petition for Divorce (1A)', required: true, status: 'ready' },
        { name: 'Separation Agreement', required: true, status: 'draft' },
        { name: 'Affidavit of Irretrievable Breakdown', required: true, status: 'ready' }
      );
    }
    
    if (data.hasChildren) {
      documents.push(
        { name: 'Child Support Guidelines Worksheet', required: true, status: 'pending' },
        { name: 'Parenting Plan', required: true, status: 'draft' },
        { name: 'Affidavit Disclosing Care or Custody', required: true, status: 'ready' }
      );
    }
    
    if (data.hasProperty) {
      documents.push(
        { name: 'Financial Statement (Long Form)', required: true, status: 'pending' },
        { name: 'Rule 401 Disclosure', required: true, status: 'pending' }
      );
    }
    
    if (data.seekingAlimony) {
      documents.push(
        { name: 'Alimony Affidavit', required: false, status: 'draft' }
      );
    }
    
    return documents;
  }

  // Property Division Methods
  addPropertyAsset(): void {
    if (!this.newAsset.description || this.newAsset.value <= 0) {
      return;
    }

    this.propertyAssets.push({
      ...this.newAsset,
      id: Date.now().toString()
    });

    localStorage.setItem('familyLaw_assets', JSON.stringify(this.propertyAssets));

    // Reset form
    this.newAsset = {
      id: '',
      type: 'real-estate',
      description: '',
      value: 0,
      ownership: 'joint',
      proposed: 'plaintiff'
    };
  }

  removeAsset(id: string): void {
    this.propertyAssets = this.propertyAssets.filter(asset => asset.id !== id);
    localStorage.setItem('familyLaw_assets', JSON.stringify(this.propertyAssets));
  }

  analyzePropertyDivision(): void {
    if (this.propertyAssets.length === 0) {
      return;
    }

    this.isAnalyzingProperty = true;
    const requestData = {
      propertyAssets: this.propertyAssets
    };

    this.http.post<any>('${environment.apiUrl}/api/ai/family-law/analyze-property-division', requestData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Calculate basic totals
            const totalValue = this.propertyAssets.reduce((sum, asset) => sum + asset.value, 0);
            const plaintiffAssets = this.propertyAssets.filter(a => a.proposed === 'plaintiff');
            const defendantAssets = this.propertyAssets.filter(a => a.proposed === 'defendant');
            const plaintiffTotal = plaintiffAssets.reduce((sum, asset) => sum + asset.value, 0);
            const defendantTotal = defendantAssets.reduce((sum, asset) => sum + asset.value, 0);
            
            this.propertyAnalysis = {
              totalMaritalProperty: totalValue,
              plaintiffAllocation: plaintiffTotal,
              defendantAllocation: defendantTotal,
              plaintiffPercentage: Math.round((plaintiffTotal / totalValue) * 100),
              defendantPercentage: Math.round((defendantTotal / totalValue) * 100),
              equalizationPayment: Math.abs(plaintiffTotal - defendantTotal) / 2,
              recommendation: response.analysis || this.getPropertyRecommendation(plaintiffTotal, defendantTotal, totalValue)
            };

            // Open modal with AI analysis
            if (response.analysis) {
              const contextInfo = {
                'Total Property Value': `$${totalValue.toLocaleString()}`,
                'Plaintiff Allocation': `$${plaintiffTotal.toLocaleString()} (${Math.round((plaintiffTotal / totalValue) * 100)}%)`,
                'Defendant Allocation': `$${defendantTotal.toLocaleString()} (${Math.round((defendantTotal / totalValue) * 100)}%)`,
                'Equalization Payment': `$${(Math.abs(plaintiffTotal - defendantTotal) / 2).toLocaleString()}`
              };
              this.aiModalService.openPropertyDivisionAnalysis(response.analysis, contextInfo);
            }
          } else {
            // Fallback to local calculation
            this.calculatePropertyDivisionLocally();
          }
          this.isAnalyzingProperty = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error analyzing property division:', error);
          // Fallback to local calculation
          this.calculatePropertyDivisionLocally();
          this.isAnalyzingProperty = false;
          this.cdr.detectChanges();
        }
      });
  }

  private calculatePropertyDivisionLocally(): void {
    const totalValue = this.propertyAssets.reduce((sum, asset) => sum + asset.value, 0);
    const plaintiffAssets = this.propertyAssets.filter(a => a.proposed === 'plaintiff');
    const defendantAssets = this.propertyAssets.filter(a => a.proposed === 'defendant');
    
    const plaintiffTotal = plaintiffAssets.reduce((sum, asset) => sum + asset.value, 0);
    const defendantTotal = defendantAssets.reduce((sum, asset) => sum + asset.value, 0);
    
    this.propertyAnalysis = {
      totalMaritalProperty: totalValue,
      plaintiffAllocation: plaintiffTotal,
      defendantAllocation: defendantTotal,
      plaintiffPercentage: Math.round((plaintiffTotal / totalValue) * 100),
      defendantPercentage: Math.round((defendantTotal / totalValue) * 100),
      equalizationPayment: Math.abs(plaintiffTotal - defendantTotal) / 2,
      recommendation: this.getPropertyRecommendation(plaintiffTotal, defendantTotal, totalValue)
    };
    this.isAnalyzingProperty = false;
    this.cdr.detectChanges();
  }

  private getPropertyRecommendation(plaintiff: number, defendant: number, total: number): string {
    const diff = Math.abs(plaintiff - defendant);
    const diffPercent = (diff / total) * 100;
    
    if (diffPercent < 10) {
      return 'Current division is approximately equal (within 10%)';
    } else if (diffPercent < 20) {
      return 'Minor adjustment recommended for equitable distribution';
    } else {
      return 'Significant reallocation needed for fair distribution';
    }
  }

  // Alimony Calculator Methods
  calculateAlimony(): void {
    if (this.alimonyForm.invalid) {
      this.markFormGroupTouched(this.alimonyForm);
      return;
    }

    this.isCalculatingAlimony = true;
    const formData = this.alimonyForm.value;

    this.http.post<any>('${environment.apiUrl}/api/ai/family-law/calculate-alimony', formData)
      .subscribe({
        next: (response) => {
          if (response.success && response.calculation) {
            // Parse AI response
            this.calculatedAlimony = {
              monthlyAmount: 0,
              yearlyAmount: 0,
              duration: '',
              type: formData.alimonyType,
              startDate: new Date().toLocaleDateString(),
              factors: [],
              taxImplications: 'Post-2019: Not deductible by payor, not taxable to recipient',
              calculation: response.calculation
            };
            // Try to extract amounts from response
            this.parseAlimonyCalculation(response.calculation);

            // Open modal with alimony calculation
            const contextInfo = {
              'Payor Income': `$${formData.payorIncome?.toLocaleString() || 0}`,
              'Recipient Income': `$${formData.recipientIncome?.toLocaleString() || 0}`,
              'Marriage Length': `${formData.marriageLength || 0} years`,
              'Alimony Type': formData.alimonyType,
              'Children': formData.hasChildren ? 'Yes' : 'No'
            };
            this.aiModalService.openAlimonyCalculation(response.calculation, contextInfo);
          } else {
            console.error('Alimony calculation failed');
          }
          this.isCalculatingAlimony = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error calculating alimony:', error);
          // Fallback to local calculation
          this.calculateAlimonyLocally(formData);
          this.isCalculatingAlimony = false;
          this.cdr.detectChanges();
        }
      });
  }

  private parseAlimonyCalculation(calculation: string): void {
    // Try to extract amounts from AI response
    const monthlyMatch = calculation.match(/monthly[\s:]+\$?([\d,]+)/i);
    const yearlyMatch = calculation.match(/annual|yearly[\s:]+\$?([\d,]+)/i);
    const durationMatch = calculation.match(/duration[\s:]+([\d]+\s*years?|indefinite)/i);
    
    if (monthlyMatch) {
      this.calculatedAlimony.monthlyAmount = parseInt(monthlyMatch[1].replace(/,/g, ''));
    }
    if (yearlyMatch) {
      this.calculatedAlimony.yearlyAmount = parseInt(yearlyMatch[1].replace(/,/g, ''));
    }
    if (durationMatch) {
      this.calculatedAlimony.duration = durationMatch[1];
    }
  }

  private calculateAlimonyLocally(formData: any): void {
    // Fallback local calculation
    const incomeDifference = Math.max(0, formData.payorIncome - formData.recipientIncome);
    const baseAmount = incomeDifference * 0.30;
    let duration = this.calculateAlimonyDuration(formData.marriageLength);
    let adjustedAmount = baseAmount;
    
    if (formData.alimonyType === 'rehabilitative') {
      const durationYears = this.getDurationInYears(formData.marriageLength);
      duration = durationYears > 5 ? '5 years' : duration;
    } else if (formData.alimonyType === 'reimbursement') {
      adjustedAmount = baseAmount * 0.8;
    } else if (formData.alimonyType === 'transitional') {
      const durationYears = this.getDurationInYears(formData.marriageLength);
      duration = durationYears > 3 ? '3 years' : duration;
      adjustedAmount = baseAmount * 0.6;
    }
    
    this.calculatedAlimony = {
      monthlyAmount: Math.round(adjustedAmount / 12),
      yearlyAmount: Math.round(adjustedAmount),
      duration: duration,
      type: formData.alimonyType,
      startDate: new Date().toLocaleDateString(),
      factors: this.getAlimonyFactors(formData),
      taxImplications: 'Post-2019: Not deductible by payor, not taxable to recipient'
    };
    this.isCalculatingAlimony = false;
    this.cdr.detectChanges();
  }

  private getDurationInYears(marriageLength: number): number {
    if (marriageLength < 5) {
      return Math.round(marriageLength * 0.5);
    } else if (marriageLength < 10) {
      return Math.round(marriageLength * 0.6);
    } else if (marriageLength < 15) {
      return Math.round(marriageLength * 0.7);
    } else if (marriageLength < 20) {
      return Math.round(marriageLength * 0.8);
    } else {
      return 999; // Indefinite
    }
  }

  private calculateAlimonyDuration(marriageLength: number): string {
    if (marriageLength < 5) {
      const years = Math.round(marriageLength * 0.5);
      return `${years} years`;
    } else if (marriageLength < 10) {
      const years = Math.round(marriageLength * 0.6);
      return `${years} years`;
    } else if (marriageLength < 15) {
      const years = Math.round(marriageLength * 0.7);
      return `${years} years`;
    } else if (marriageLength < 20) {
      const years = Math.round(marriageLength * 0.8);
      return `${years} years`;
    } else {
      return 'Indefinite';
    }
  }

  private getAlimonyFactors(data: any): string[] {
    const factors = [];
    factors.push(`Marriage duration: ${data.marriageLength} years`);
    factors.push(`Income disparity: $${Math.abs(data.payorIncome - data.recipientIncome).toLocaleString()}`);
    if (data.healthConditions) {
      factors.push('Health conditions considered');
    }
    if (data.contributions) {
      factors.push('Non-economic contributions recognized');
    }
    return factors;
  }


  // Helper methods for UI
  getAssetTypeIcon(type: string): string {
    const icons: any = {
      'real-estate': 'ri-home-4-line',
      'vehicle': 'ri-car-line',
      'retirement': 'ri-safe-line',
      'investment': 'ri-stock-line',
      'personal': 'ri-gift-line',
      'business': 'ri-briefcase-line'
    };
    return icons[type] || 'ri-file-line';
  }

  getDocumentStatusClass(status: string): string {
    const classes: any = {
      'ready': 'badge bg-success',
      'draft': 'badge bg-warning',
      'pending': 'badge bg-info'
    };
    return classes[status] || 'badge bg-secondary';
  }

  // Sample Data Methods for Testing
  loadChildSupportSample(): void {
    this.childSupportForm.patchValue({
      custodialIncome: 65000,
      nonCustodialIncome: 85000,
      numberOfChildren: 2,
      healthcareCosts: 3600,
      childcareCosts: 12000,
      overnights: 104,
      specialNeeds: false,
      additionalExpenses: 2400
    });
  }

  loadCustodySample(): void {
    this.custodyForm.patchValue({
      custodyType: 'joint-physical',
      parent1Name: 'Sarah Johnson',
      parent2Name: 'Michael Johnson',
      childrenNames: 'Emma Johnson (age 8), Liam Johnson (age 5)',
      residenceArrangement: 'Week-on/week-off alternating schedule',
      holidaySchedule: 'Alternating major holidays, Thanksgiving/Christmas split',
      summerSchedule: 'Two consecutive weeks each parent',
      transportationArrangement: 'Parents meet halfway for exchanges',
      decisionMaking: 'Joint legal custody - major decisions require mutual agreement',
      communicationPlan: 'Weekly co-parenting app check-ins',
      effectiveDate: '2024-01-15'
    });
  }

  loadPropertySample(): void {
    this.propertyAssets = [
      {
        id: '1',
        type: 'real-estate',
        description: 'Primary residence at 123 Maple Street',
        value: 450000,
        ownership: 'joint',
        proposed: 'plaintiff'
      },
      {
        id: '2',
        type: 'vehicle',
        description: '2020 Honda Accord',
        value: 28000,
        ownership: 'joint',
        proposed: 'defendant'
      },
      {
        id: '3',
        type: 'retirement',
        description: '401(k) retirement account',
        value: 125000,
        ownership: 'joint',
        proposed: 'plaintiff'
      }
    ];
  }

  loadAlimonySample(): void {
    this.alimonyForm.patchValue({
      payorIncome: 95000,
      recipientIncome: 35000,
      marriageLength: 12,
      alimonyType: 'general',
      hasChildren: true,
      payorAge: 45,
      recipientAge: 42,
      healthConditions: false,
      contributions: true,
      remarriageProspects: false
    });
  }

  loadDivorceSample(): void {
    this.divorceForm.patchValue({
      divorceType: 'uncontested',
      plaintiffName: 'Jennifer Smith',
      defendantName: 'Robert Smith',
      marriageDate: '2010-06-15',
      separationDate: '2023-08-01',
      hasMinorChildren: true,
      jurisdiction: 'Massachusetts',
      groundsForDivorce: 'Irretrievable breakdown of marriage',
      propertyAgreement: true,
      custodyAgreement: true,
      supportAgreement: true
    });
  }
}