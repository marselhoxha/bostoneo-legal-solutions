import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AiResponseFormatterPipe } from '../../shared/ai-response-formatter.pipe';
import { AiResponseModalService } from '../../shared/services/ai-response-modal.service';
import { environment } from '../../../../../../../environments/environment';

interface PropertyDetails {
  address: string;
  parcelNumber: string;
  legalDescription: string;
  propertyType: string;
  squareFootage: number;
  yearBuilt: number;
  zoning: string;
}

interface ClosingDocument {
  name: string;
  type: string;
  required: boolean;
  status: string;
  party: string;
}

interface TitleIssue {
  id: string;
  type: string;
  description: string;
  severity: string;
  resolution: string;
  resolved: boolean;
}

@Component({
  selector: 'app-real-estate',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, AiResponseFormatterPipe],
  templateUrl: './real-estate.component.html',
  styleUrls: ['./real-estate.component.scss']
})
export class RealEstateComponent implements OnInit {
  activeTab: string = 'purchase-agreement';
  
  // Purchase Agreement Generator
  purchaseForm: FormGroup;
  generatedAgreement: string = '';
  isGeneratingAgreement: boolean = false;
  
  // Closing Document Preparation
  closingForm: FormGroup;
  closingDocuments: ClosingDocument[] = [];
  closingDate: Date | null = null;
  
  // Title Review Checklist
  titleReviewForm: FormGroup;
  titleIssues: TitleIssue[] = [];
  titleClearance: number = 0;
  
  // Deed Drafting
  deedForm: FormGroup;
  generatedDeed: string = '';
  isGeneratingDeed: boolean = false;
  deedTypes = [
    { value: 'warranty', label: 'General Warranty Deed' },
    { value: 'special-warranty', label: 'Special Warranty Deed' },
    { value: 'quitclaim', label: 'Quitclaim Deed' },
    { value: 'bargain-sale', label: 'Bargain and Sale Deed' },
    { value: 'grant', label: 'Grant Deed' }
  ];
  
  // Lease Agreement Creator
  leaseForm: FormGroup;
  generatedLease: string = '';
  isGeneratingLease: boolean = false;
  leaseTypes = [
    { value: 'residential', label: 'Residential Lease' },
    { value: 'commercial', label: 'Commercial Lease' },
    { value: 'month-to-month', label: 'Month-to-Month' },
    { value: 'sublease', label: 'Sublease Agreement' },
    { value: 'room-rental', label: 'Room Rental Agreement' }
  ];
  
  propertyTypes = [
    { value: 'single-family', label: 'Single Family Home' },
    { value: 'condo', label: 'Condominium' },
    { value: 'townhouse', label: 'Townhouse' },
    { value: 'multi-family', label: 'Multi-Family' },
    { value: 'commercial', label: 'Commercial Property' },
    { value: 'land', label: 'Vacant Land' }
  ];
  
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private aiModalService: AiResponseModalService
  ) {
    // Initialize Purchase Agreement Form - Only essential fields required
    this.purchaseForm = this.fb.group({
      // Property Information
      propertyAddress: ['', Validators.required],
      propertyType: ['single-family', Validators.required],
      legalDescription: [''],
      parcelNumber: [''],
      
      // Parties
      sellerName: ['', Validators.required],
      sellerAddress: [''],
      buyerName: ['', Validators.required],
      buyerAddress: [''],
      
      // Terms
      purchasePrice: [0, [Validators.required, Validators.min(1)]],
      earnestMoney: [0, Validators.min(0)],
      downPayment: [0, Validators.min(0)],
      financingContingency: [true],
      inspectionContingency: [true],
      appraisalContingency: [true],
      closingDate: ['', Validators.required],
      possessionDate: [''],
      
      // Additional Terms
      includedItems: [''],
      excludedItems: [''],
      sellerConcessions: [0],
      homeWarranty: [false],
      closingCostSplit: ['conventional']
    });

    // Initialize Closing Form
    this.closingForm = this.fb.group({
      transactionType: ['purchase', Validators.required],
      closingDate: ['', Validators.required],
      propertyAddress: ['', Validators.required],
      purchasePrice: [0, [Validators.required, Validators.min(1)]],
      loanAmount: [0, Validators.min(0)],
      escrowAgent: ['', Validators.required],
      titleCompany: ['', Validators.required],
      buyers: ['', Validators.required],
      sellers: ['', Validators.required]
    });

    // Initialize Title Review Form
    this.titleReviewForm = this.fb.group({
      propertyAddress: ['', Validators.required],
      titleCompany: ['', Validators.required],
      titleNumber: ['', Validators.required],
      effectiveDate: ['', Validators.required],
      vestingType: ['', Validators.required],
      currentOwner: ['', Validators.required],
      encumbrances: [''],
      easements: [''],
      restrictions: ['']
    });

    // Initialize Deed Form
    this.deedForm = this.fb.group({
      deedType: ['warranty', Validators.required],
      grantor: this.fb.group({
        name: ['', Validators.required],
        address: ['', Validators.required],
        maritalStatus: ['', Validators.required]
      }),
      grantee: this.fb.group({
        name: ['', Validators.required],
        address: ['', Validators.required],
        vestingType: ['', Validators.required]
      }),
      property: this.fb.group({
        address: ['', Validators.required],
        legalDescription: ['', Validators.required],
        parcelNumber: [''],
        county: ['', Validators.required],
        state: ['Massachusetts', Validators.required]
      }),
      consideration: [10, [Validators.required, Validators.min(1)]],
      taxStamps: [0],
      recordingInfo: ['']
    });

    // Initialize Lease Form
    this.leaseForm = this.fb.group({
      leaseType: ['residential', Validators.required],
      // Property
      propertyAddress: ['', Validators.required],
      propertyType: ['', Validators.required],
      unitNumber: [''],
      // Parties
      landlordName: ['', Validators.required],
      landlordAddress: ['', Validators.required],
      tenantNames: ['', Validators.required],
      // Terms
      leaseStartDate: ['', Validators.required],
      leaseEndDate: ['', Validators.required],
      monthlyRent: [0, [Validators.required, Validators.min(1)]],
      securityDeposit: [0, [Validators.required, Validators.min(0)]],
      lastMonthRent: [false],
      // Rules and Conditions
      petsAllowed: [false],
      petDeposit: [0],
      maxOccupants: [2, [Validators.required, Validators.min(1)]],
      smokingAllowed: [false],
      parkingSpaces: [0],
      utilities: this.fb.group({
        electricity: ['tenant'],
        gas: ['tenant'],
        water: ['landlord'],
        trash: ['landlord'],
        internet: ['tenant']
      }),
      maintenanceResponsibilities: [''],
      lateFeePeriod: [5, Validators.min(1)],
      lateFeeAmount: [0]
    });
  }

  ngOnInit(): void {
    this.loadSavedData();
  }

  loadSavedData(): void {
    // Load any saved title issues
    const savedIssues = localStorage.getItem('realEstate_titleIssues');
    if (savedIssues) {
      this.titleIssues = JSON.parse(savedIssues);
      this.calculateTitleClearance();
    }
  }

  // Tab Navigation
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Purchase Agreement Methods
  generatePurchaseAgreement(): void {
    if (this.purchaseForm.invalid) {
      this.markFormGroupTouched(this.purchaseForm);
      return;
    }

    this.isGeneratingAgreement = true;
    const formData = this.purchaseForm.value;
    
    this.http.post<any>('${environment.apiUrl}/api/ai/real-estate/generate-purchase-agreement', formData)
      .subscribe({
        next: (response) => {
          if (response.success && response.content) {
            this.generatedAgreement = response.content;

            // Open modal with purchase agreement
            const contextInfo = {
              'Property Address': formData.propertyAddress,
              'Purchase Price': `$${formData.purchasePrice?.toLocaleString() || 0}`,
              'Buyer': formData.buyerName,
              'Seller': formData.sellerName,
              'Closing Date': formData.closingDate
            };
            this.aiModalService.openPurchaseAgreement(response.content, contextInfo);
          } else {
            this.generatedAgreement = 'Error generating agreement. Please try again.';
          }
          this.isGeneratingAgreement = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error generating purchase agreement:', error);
          this.generatedAgreement = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingAgreement = false;
          this.cdr.detectChanges();
        }
      });
  }

  private createPurchaseAgreement(data: any): string {
    return `
PURCHASE AND SALE AGREEMENT

This Agreement is entered into on ${new Date().toLocaleDateString()} between:

SELLER: ${data.sellerName}
Address: ${data.sellerAddress}

BUYER: ${data.buyerName}
Address: ${data.buyerAddress}

PROPERTY: ${data.propertyAddress}
Legal Description: ${data.legalDescription}
${data.parcelNumber ? `Parcel Number: ${data.parcelNumber}` : ''}

1. PURCHASE PRICE
The total purchase price for the Property is $${data.purchasePrice.toLocaleString()}.

2. EARNEST MONEY
Buyer shall deposit $${data.earnestMoney.toLocaleString()} as earnest money within 3 business days of acceptance.

3. DOWN PAYMENT
Buyer shall pay a down payment of $${data.downPayment.toLocaleString()} at closing.

4. CONTINGENCIES
${data.financingContingency ? '☑ Financing Contingency: This offer is contingent upon Buyer obtaining financing.' : ''}
${data.inspectionContingency ? '☑ Inspection Contingency: Buyer has the right to inspect the property within 10 days.' : ''}
${data.appraisalContingency ? '☑ Appraisal Contingency: Sale is contingent upon property appraising for at least the purchase price.' : ''}

5. CLOSING AND POSSESSION
Closing Date: ${data.closingDate}
Possession Date: ${data.possessionDate}

6. INCLUDED/EXCLUDED ITEMS
Included: ${data.includedItems || 'All fixtures and fittings attached to the property'}
Excluded: ${data.excludedItems || 'None'}

7. SELLER CONCESSIONS
Seller agrees to contribute $${data.sellerConcessions.toLocaleString()} toward Buyer's closing costs.

8. CLOSING COSTS
Closing costs shall be divided according to ${data.closingCostSplit} practice.

${data.homeWarranty ? '9. HOME WARRANTY\nSeller shall provide a home warranty at Seller\'s expense.' : ''}

10. DEFAULT
If Buyer defaults, Seller may retain earnest money as liquidated damages. If Seller defaults, Buyer may seek specific performance or damages.

11. ENTIRE AGREEMENT
This constitutes the entire agreement between the parties.

SELLER: _______________________  Date: __________
        ${data.sellerName}

BUYER: _______________________  Date: __________
       ${data.buyerName}
    `.trim();
  }

  // Closing Document Methods
  prepareClosingDocuments(): void {
    if (this.closingForm.invalid) {
      this.markFormGroupTouched(this.closingForm);
      return;
    }

    const data = this.closingForm.value;
    this.closingDate = new Date(data.closingDate);
    
    // Call Claude AI for closing checklist
    const requestData = {
      transactionType: data.transactionType,
      propertyType: 'residential', // Add this to form if needed
      financing: data.loanAmount > 0 ? 'conventional' : 'cash',
      closingDate: data.closingDate
    };
    
    this.http.post<any>('${environment.apiUrl}/api/ai/real-estate/generate-closing-checklist', requestData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Generate document list based on AI checklist
            this.closingDocuments = this.generateClosingDocumentList(data);
            // Add AI insights as additional notes
            if (response.checklist) {
              this.closingDocuments.push({
                name: 'AI Closing Checklist',
                type: 'checklist',
                required: false,
                status: 'completed',
                party: 'both'
              });

              // Open modal with closing documents checklist
              const contextInfo = {
                'Transaction Type': data.transactionType,
                'Purchase Price': `$${data.purchasePrice?.toLocaleString() || 0}`,
                'Loan Amount': `$${data.loanAmount?.toLocaleString() || 0}`,
                'Closing Date': data.closingDate,
                'Title Company': data.titleCompany
              };
              this.aiModalService.openClosingDocument(response.checklist, contextInfo);
            }
          } else {
            // Fallback to default document list
            this.closingDocuments = this.generateClosingDocumentList(data);
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error generating closing checklist:', error);
          // Fallback to default document list
          this.closingDocuments = this.generateClosingDocumentList(data);
          this.cdr.detectChanges();
        }
      });
  }

  private generateClosingDocumentList(data: any): ClosingDocument[] {
    const documents: ClosingDocument[] = [];
    
    // Standard closing documents
    documents.push(
      { name: 'Settlement Statement (HUD-1/CD)', type: 'financial', required: true, status: 'pending', party: 'both' },
      { name: 'Deed', type: 'transfer', required: true, status: 'draft', party: 'seller' },
      { name: 'Bill of Sale', type: 'transfer', required: false, status: 'pending', party: 'seller' },
      { name: 'Title Insurance Policy', type: 'title', required: true, status: 'pending', party: 'buyer' },
      { name: 'Property Disclosure Statement', type: 'disclosure', required: true, status: 'pending', party: 'seller' },
      { name: 'Lead Paint Disclosure', type: 'disclosure', required: true, status: 'pending', party: 'seller' }
    );
    
    if (data.loanAmount > 0) {
      documents.push(
        { name: 'Promissory Note', type: 'loan', required: true, status: 'pending', party: 'buyer' },
        { name: 'Mortgage/Deed of Trust', type: 'loan', required: true, status: 'pending', party: 'buyer' },
        { name: 'Loan Estimate', type: 'loan', required: true, status: 'completed', party: 'buyer' },
        { name: 'Closing Disclosure', type: 'loan', required: true, status: 'pending', party: 'buyer' }
      );
    }
    
    // Additional documents
    documents.push(
      { name: 'Affidavit of Title', type: 'title', required: true, status: 'pending', party: 'seller' },
      { name: 'Certificate of Occupancy', type: 'compliance', required: false, status: 'pending', party: 'seller' },
      { name: 'Smoke Detector Certificate', type: 'compliance', required: true, status: 'pending', party: 'seller' },
      { name: 'Final Walk-Through Form', type: 'inspection', required: false, status: 'pending', party: 'buyer' },
      { name: 'Power of Attorney', type: 'authority', required: false, status: 'n/a', party: 'both' }
    );
    
    return documents;
  }

  toggleDocumentStatus(doc: ClosingDocument): void {
    const statuses = ['pending', 'draft', 'completed', 'n/a'];
    const currentIndex = statuses.indexOf(doc.status);
    doc.status = statuses[(currentIndex + 1) % statuses.length];
  }

  // Title Review Methods
  performTitleReview(): void {
    if (this.titleReviewForm.invalid) {
      this.markFormGroupTouched(this.titleReviewForm);
      return;
    }

    const data = this.titleReviewForm.value;
    
    // Call Claude AI for title analysis
    const requestData = {
      propertyAddress: data.propertyAddress,
      currentOwner: data.currentOwner,
      chainOfTitle: `Title Company: ${data.titleCompany}, Number: ${data.titleNumber}`,
      liens: 'To be reviewed',
      encumbrances: data.encumbrances,
      easements: data.easements
    };
    
    this.http.post<any>('${environment.apiUrl}/api/ai/real-estate/analyze-title', requestData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Parse AI response to extract title issues
            this.titleIssues = this.parseAITitleAnalysis(response.analysis);
            this.saveTitleIssues();
            this.calculateTitleClearance();
          } else {
            console.error('Title analysis failed');
          }
        },
        error: (error) => {
          console.error('Error analyzing title:', error);
          // Fallback to sample issues
          this.titleIssues = [
            {
              id: '1',
              type: 'other',
              description: 'Unable to complete AI analysis',
              severity: 'high',
              resolution: 'Please retry or contact support',
              resolved: false
            }
          ];
          this.saveTitleIssues();
          this.calculateTitleClearance();
        }
      });
  }

  private parseAITitleAnalysis(analysisText: string): TitleIssue[] {
    // Basic parsing of AI response to extract issues
    const issues: TitleIssue[] = [];
    let issueId = 1;
    
    // Look for common title issue keywords
    if (analysisText.toLowerCase().includes('lien')) {
      issues.push({
        id: String(issueId++),
        type: 'lien',
        description: 'Potential lien identified - review required',
        severity: 'high',
        resolution: 'Obtain lien release or clearance',
        resolved: false
      });
    }
    
    if (analysisText.toLowerCase().includes('easement')) {
      issues.push({
        id: String(issueId++),
        type: 'easement',
        description: 'Easement identified - verify impact',
        severity: 'medium',
        resolution: 'Review easement terms and location',
        resolved: false
      });
    }
    
    if (issues.length === 0) {
      issues.push({
        id: String(issueId++),
        type: 'other',
        description: 'Title appears clear - no major issues found',
        severity: 'low',
        resolution: 'Proceed with standard closing',
        resolved: true
      });
    }
    
    return issues;
  }

  addTitleIssue(): void {
    const newIssue: TitleIssue = {
      id: Date.now().toString(),
      type: 'other',
      description: '',
      severity: 'medium',
      resolution: '',
      resolved: false
    };
    
    // In a real app, this would open a modal or form to add details
    this.titleIssues.push(newIssue);
    this.saveTitleIssues();
    this.calculateTitleClearance();
  }

  toggleIssueResolution(issue: TitleIssue): void {
    issue.resolved = !issue.resolved;
    this.saveTitleIssues();
    this.calculateTitleClearance();
  }

  removeTitleIssue(id: string): void {
    this.titleIssues = this.titleIssues.filter(issue => issue.id !== id);
    this.saveTitleIssues();
    this.calculateTitleClearance();
  }

  private saveTitleIssues(): void {
    localStorage.setItem('realEstate_titleIssues', JSON.stringify(this.titleIssues));
  }

  private calculateTitleClearance(): void {
    if (this.titleIssues.length === 0) {
      this.titleClearance = 100;
    } else {
      const resolved = this.titleIssues.filter(i => i.resolved).length;
      this.titleClearance = Math.round((resolved / this.titleIssues.length) * 100);
    }
  }

  // Deed Drafting Methods
  generateDeed(): void {
    if (this.deedForm.invalid) {
      this.markFormGroupTouched(this.deedForm);
      return;
    }

    this.isGeneratingDeed = true;
    const formData = this.deedForm.value;
    
    // Flatten nested form data for API
    const requestData = {
      deedType: formData.deedType,
      grantor: `${formData.grantor.name}, ${formData.grantor.maritalStatus} of ${formData.grantor.address}`,
      grantee: `${formData.grantee.name} as ${formData.grantee.vestingType} of ${formData.grantee.address}`,
      propertyAddress: formData.property.address,
      legalDescription: formData.property.legalDescription,
      consideration: formData.consideration
    };
    
    this.http.post<any>('${environment.apiUrl}/api/ai/real-estate/generate-deed', requestData)
      .subscribe({
        next: (response) => {
          if (response.success && response.content) {
            this.generatedDeed = response.content;

            // Open modal with deed draft
            const contextInfo = {
              'Deed Type': formData.deedType,
              'Grantor': requestData.grantor,
              'Grantee': requestData.grantee,
              'Property': requestData.propertyAddress,
              'Consideration': `$${formData.consideration?.toLocaleString() || 0}`
            };
            this.aiModalService.openDeedDraft(response.content, contextInfo);
          } else {
            this.generatedDeed = 'Error generating deed. Please try again.';
          this.cdr.detectChanges();
          }
          this.isGeneratingDeed = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error generating deed:', error);
          this.generatedDeed = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingDeed = false;
          this.cdr.detectChanges();
        }
      });
  }

  private createDeed(data: any): string {
    const deedTypeText = this.deedTypes.find(t => t.value === data.deedType)?.label || 'Deed';
    
    return `
${deedTypeText.toUpperCase()}

KNOW ALL MEN BY THESE PRESENTS:

That ${data.grantor.name}, ${data.grantor.maritalStatus}, of ${data.grantor.address} (hereinafter "Grantor"), 
for consideration paid, and in the amount of ${data.consideration === 10 ? 'Ten Dollars ($10.00) and other good and valuable consideration' : `$${data.consideration.toLocaleString()}`}, 
the receipt of which is hereby acknowledged, does hereby grant, bargain, sell and convey unto:

${data.grantee.name}, as ${data.grantee.vestingType}, of ${data.grantee.address} (hereinafter "Grantee"),

The following described real property situated in ${data.property.county} County, ${data.property.state}:

Property Address: ${data.property.address}

Legal Description:
${data.property.legalDescription}

${data.property.parcelNumber ? `Parcel Number: ${data.property.parcelNumber}` : ''}

${data.deedType === 'warranty' ? `Together with all the tenements, hereditaments, and appurtenances thereto belonging or in anywise appertaining.

TO HAVE AND TO HOLD the above described premises unto the Grantee, and to Grantee's heirs and assigns forever.

The Grantor hereby covenants with the Grantee that:
1. Grantor is lawfully seized of the premises in fee simple
2. Grantor has good right to convey the same
3. The premises are free from all encumbrances except as noted
4. Grantor will warrant and defend the title against all lawful claims` : ''}

${data.deedType === 'quitclaim' ? `The Grantor hereby remises, releases, and quitclaims unto the Grantee all right, title, interest, and claim which the Grantor has in and to the above-described property.` : ''}

IN WITNESS WHEREOF, the Grantor has executed this deed on ${new Date().toLocaleDateString()}.

_______________________
${data.grantor.name}
Grantor

State of ${data.property.state}
County of ${data.property.county}

On this _____ day of __________, 20__, before me personally appeared ${data.grantor.name}, 
proved to me on the basis of satisfactory evidence to be the person whose name is subscribed 
to the within instrument and acknowledged that he/she executed the same in his/her authorized capacity.

_______________________
Notary Public
My commission expires: __________
    `.trim();
  }

  // Lease Agreement Methods
  generateLeaseAgreement(): void {
    if (this.leaseForm.invalid) {
      this.markFormGroupTouched(this.leaseForm);
      return;
    }

    this.isGeneratingLease = true;
    const formData = this.leaseForm.value;
    
    this.http.post<any>('${environment.apiUrl}/api/ai/real-estate/generate-lease', formData)
      .subscribe({
        next: (response) => {
          if (response.success && response.content) {
            this.generatedLease = response.content;

            // Open modal with lease agreement
            const contextInfo = {
              'Property Address': formData.propertyAddress,
              'Monthly Rent': `$${formData.monthlyRent?.toLocaleString() || 0}`,
              'Landlord': formData.landlordName,
              'Tenant': formData.tenantName,
              'Lease Term': `${formData.leaseTerm || 12} months`
            };
            this.aiModalService.openLeaseAgreement(response.content, contextInfo);
          } else {
            this.generatedLease = 'Error generating lease. Please try again.';
          }
          this.isGeneratingLease = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error generating lease:', error);
          this.generatedLease = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingLease = false;
          this.cdr.detectChanges();
        }
      });
  }

  private createLeaseAgreement(data: any): string {
    const leaseTypeText = this.leaseTypes.find(t => t.value === data.leaseType)?.label || 'Lease Agreement';
    
    return `
${leaseTypeText.toUpperCase()}

Date: ${new Date().toLocaleDateString()}

PARTIES:
Landlord: ${data.landlordName}
Address: ${data.landlordAddress}

Tenant(s): ${data.tenantNames}

PROPERTY:
Address: ${data.propertyAddress}
${data.unitNumber ? `Unit: ${data.unitNumber}` : ''}
Type: ${data.propertyType}

TERM:
Start Date: ${data.leaseStartDate}
End Date: ${data.leaseEndDate}
This is a ${data.leaseType === 'month-to-month' ? 'month-to-month' : 'fixed term'} lease.

RENT:
Monthly Rent: $${data.monthlyRent.toLocaleString()}
Due Date: 1st of each month
Late Fee: $${data.lateFeeAmount} if paid after day ${data.lateFeePeriod}

SECURITY DEPOSIT:
Amount: $${data.securityDeposit.toLocaleString()}
${data.lastMonthRent ? `Last Month's Rent: $${data.monthlyRent.toLocaleString()}` : ''}
${data.petsAllowed && data.petDeposit > 0 ? `Pet Deposit: $${data.petDeposit}` : ''}

UTILITIES:
Electricity: ${data.utilities.electricity === 'tenant' ? 'Tenant' : 'Landlord'}
Gas: ${data.utilities.gas === 'tenant' ? 'Tenant' : 'Landlord'}
Water/Sewer: ${data.utilities.water === 'tenant' ? 'Tenant' : 'Landlord'}
Trash: ${data.utilities.trash === 'tenant' ? 'Tenant' : 'Landlord'}
Internet/Cable: ${data.utilities.internet === 'tenant' ? 'Tenant' : 'Landlord'}

OCCUPANCY:
Maximum Occupants: ${data.maxOccupants}
Pets: ${data.petsAllowed ? 'Allowed with deposit' : 'Not Allowed'}
Smoking: ${data.smokingAllowed ? 'Allowed' : 'Not Allowed'}
Parking Spaces: ${data.parkingSpaces}

MAINTENANCE:
${data.maintenanceResponsibilities || 'Tenant responsible for minor repairs under $100. Landlord responsible for major repairs and maintenance.'}

TERMINATION:
Either party may terminate with 30 days written notice for month-to-month tenancy.
Early termination of fixed-term lease subject to penalties.

ADDITIONAL TERMS:
1. Tenant shall maintain renter's insurance
2. No subletting without written consent
3. Quiet enjoyment hours: 10 PM - 7 AM
4. Landlord access with 24-hour notice except emergencies

By signing below, all parties agree to the terms of this lease agreement.

_______________________     Date: __________
${data.landlordName}
Landlord

_______________________     Date: __________
Tenant

_______________________     Date: __________
Tenant
    `.trim();
  }

  // Export functionality
  exportDocument(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  // Helper methods
  getDocumentStatusClass(status: string): string {
    const classes: any = {
      'completed': 'badge bg-success',
      'draft': 'badge bg-warning',
      'pending': 'badge bg-info',
      'n/a': 'badge bg-secondary'
    };
    return classes[status] || 'badge bg-secondary';
  }

  getIssueTypeIcon(type: string): string {
    const icons: any = {
      'lien': 'ri-link-unlink',
      'easement': 'ri-road-line',
      'encroachment': 'ri-alert-line',
      'restriction': 'ri-forbid-line',
      'other': 'ri-question-line'
    };
    return icons[type] || 'ri-file-line';
  }

  getIssueSeverityClass(severity: string): string {
    const classes: any = {
      'high': 'text-danger',
      'medium': 'text-warning',
      'low': 'text-info'
    };
    return classes[severity] || 'text-secondary';
  }

  // Helper method to check if a form control is invalid and touched
  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // Helper method to check if a field is required
  isFieldRequired(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    if (field && field.validator) {
      const validator = field.validator({} as any);
      return !!(validator && validator['required']);
    }
    return false;
  }

  // Helper to mark all fields as touched for validation display
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control) {
        control.markAsTouched();
        if (control instanceof FormGroup) {
          this.markFormGroupTouched(control);
        }
      }
    });
  }

  // Load Sample Data Methods
  loadSamplePurchaseAgreement(): void {
    this.purchaseForm.patchValue({
      propertyAddress: '123 Maple Street, Boston, MA 02108',
      propertyType: 'single-family',
      legalDescription: 'A certain parcel of land with the buildings thereon situated in Boston, Suffolk County, Massachusetts, being shown as Lot 15 on Plan entitled "Maple Hill Estates" recorded in Suffolk County Registry of Deeds Plan Book 450, Page 25, and bounded and described as follows: Beginning at the southeasterly corner of said Lot 15...',
      parcelNumber: '123-456-789',
      sellerName: 'Robert and Linda Johnson',
      sellerAddress: '123 Maple Street, Boston, MA 02108',
      buyerName: 'Michael and Sarah Davis',
      buyerAddress: '456 Oak Avenue, Cambridge, MA 02139',
      purchasePrice: 750000,
      earnestMoney: 15000,
      downPayment: 150000,
      financingContingency: true,
      inspectionContingency: true,
      appraisalContingency: true,
      closingDate: '2024-06-15',
      possessionDate: '2024-06-15',
      includedItems: 'All fixtures, built-in appliances, window treatments, ceiling fans, garage door opener with remotes, automatic sprinkler system',
      excludedItems: 'Personal property, outdoor furniture, garden tools, washer/dryer',
      sellerConcessions: 5000,
      homeWarranty: true,
      closingCostSplit: 'conventional'
    });
  }

  loadSampleLeaseAgreement(): void {
    this.leaseForm.patchValue({
      leaseType: 'residential',
      propertyAddress: '789 Commonwealth Avenue, Unit 3B, Boston, MA 02215',
      propertyType: 'condo',
      unitNumber: '3B',
      landlordName: 'Boston Properties LLC',
      landlordAddress: '100 Federal Street, Suite 500, Boston, MA 02110',
      tenantNames: 'Jennifer Smith and David Wilson',
      leaseStartDate: '2024-07-01',
      leaseEndDate: '2025-06-30',
      monthlyRent: 3200,
      securityDeposit: 3200,
      lastMonthRent: true,
      petsAllowed: true,
      petDeposit: 500,
      maxOccupants: 2,
      smokingAllowed: false,
      parkingSpaces: 1,
      utilities: {
        electricity: 'tenant',
        gas: 'tenant',
        water: 'landlord',
        trash: 'landlord',
        internet: 'tenant'
      },
      maintenanceResponsibilities: 'Tenant responsible for minor repairs under $100. Landlord responsible for major systems, structural repairs, and appliance replacement. Tenant must maintain clean and sanitary condition.',
      lateFeePeriod: 5,
      lateFeeAmount: 50
    });
  }

  loadSampleTitleReview(): void {
    this.titleReviewForm.patchValue({
      propertyAddress: '567 Beacon Hill Drive, Boston, MA 02108',
      titleCompany: 'Commonwealth Title & Escrow Company',
      titleNumber: 'CT-2024-5678',
      effectiveDate: '2024-05-01',
      vestingType: 'Joint Tenants with Right of Survivorship',
      currentOwner: 'James and Patricia Williams',
      encumbrances: 'Mortgage dated March 15, 2018, recorded in Book 45123, Page 567, in favor of First National Bank in the amount of $425,000 (current balance approximately $385,000)',
      easements: '20-foot utility easement along the rear property line as shown on recorded plan; 5-foot drainage easement along the eastern boundary',
      restrictions: 'Single-family residential use only; no structures within 25 feet of front property line; architectural approval required for exterior modifications per HOA covenants recorded in Book 23456, Page 789'
    });
  }

  loadSampleDeedDrafting(): void {
    this.deedForm.patchValue({
      deedType: 'warranty',
      grantor: {
        name: 'Thomas Edward Mitchell',
        address: '234 Harvard Street, Cambridge, MA 02138',
        maritalStatus: 'single'
      },
      grantee: {
        name: 'Kevin and Amanda Rodriguez',
        address: '456 Commonwealth Avenue, Boston, MA 02215',
        vestingType: 'tenants by the entirety'
      },
      property: {
        address: '890 Newbury Street, Boston, MA 02115',
        legalDescription: 'A certain parcel of land with the buildings thereon, situated in Boston, Suffolk County, Massachusetts, bounded and described as follows: Beginning at a point on the southerly side of Newbury Street, distant 150 feet westerly from the corner formed by the intersection of Newbury Street and Dartmouth Street; thence running southerly parallel to Dartmouth Street 100 feet; thence westerly parallel to Newbury Street 50 feet; thence northerly parallel to Dartmouth Street 100 feet to Newbury Street; thence easterly along Newbury Street 50 feet to the point of beginning.',
        parcelNumber: '0201-234-567',
        county: 'Suffolk',
        state: 'Massachusetts'
      },
      consideration: 850000,
      taxStamps: 3400,
      recordingInfo: 'To be recorded at Suffolk County Registry of Deeds'
    });
  }

  loadSampleClosingDocuments(): void {
    this.closingForm.patchValue({
      transactionType: 'purchase',
      closingDate: '2024-06-30',
      propertyAddress: '321 Commonwealth Avenue, Boston, MA 02115',
      purchasePrice: 950000,
      loanAmount: 760000,
      escrowAgent: 'Boston Title & Escrow Services',
      titleCompany: 'Commonwealth Title Insurance Company',
      buyers: 'Ryan and Michelle Thompson',
      sellers: 'Charles and Elizabeth Adams'
    });
  }
}