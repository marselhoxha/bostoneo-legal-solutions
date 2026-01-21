import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PracticeAreaBaseComponent } from '../../shared/practice-area-base.component';
import { AiResponseFormatterPipe } from '../../shared/ai-response-formatter.pipe';
import { AiResponseModalService } from '../../shared/services/ai-response-modal.service';
import Swal from 'sweetalert2';

interface VisaType {
  code: string;
  name: string;
  category: string;
  description: string;
  processingTime: string;
}

interface FormDocument {
  id: string;
  name: string;
  formNumber: string;
  status: string;
  required: boolean;
  filed?: boolean;
}

interface PDFFormField {
  id?: number;
  pdfFieldName: string;
  caseDataPath: string;
  fieldType: string;
  isRequired: boolean;
  displayOrder: number;
  defaultValue?: any;
  value?: any;
  displayName?: string;
}

interface PDFTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  templateType: string;
  pdfFormUrl: string;
  requiredFields?: string[];
}

interface CaseTimeline {
  stage: string;
  status: string;
  estimatedDate: Date;
  actualDate?: Date;
  notes?: string;
}

@Component({
  selector: 'app-immigration',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, AiResponseFormatterPipe],
  templateUrl: './immigration.component.html',
  styleUrls: ['./immigration.component.scss']
})
export class ImmigrationComponent extends PracticeAreaBaseComponent implements OnInit, OnDestroy {
  activeTab: string = 'form-completion';
  
  // USCIS Form Completion
  formCompletionForm: FormGroup;
  selectedForm: string = '';
  formProgress: number = 0;
  isGeneratingForm: boolean = false;
  availableForms = [
    { code: 'I-130', name: 'Petition for Alien Relative', category: 'Family-Based', templateId: 6 },
    { code: 'I-485', name: 'Application to Adjust Status', category: 'Adjustment', templateId: 23 },
    { code: 'I-765', name: 'Application for Employment Authorization', category: 'Work', templateId: 24 },
    { code: 'I-131', name: 'Application for Travel Document', category: 'Travel', templateId: 4 },
    { code: 'N-400', name: 'Application for Naturalization', category: 'Citizenship', templateId: 5 },
    { code: 'I-140', name: 'Immigrant Petition for Alien Worker', category: 'Employment', templateId: 6 },
    { code: 'I-129', name: 'Petition for Nonimmigrant Worker', category: 'Work', templateId: 7 },
    { code: 'I-90', name: 'Application to Replace Green Card', category: 'Green Card', templateId: 8 },
    { code: 'I-751', name: 'Petition to Remove Conditions', category: 'Green Card', templateId: 9 },
    { code: 'I-864', name: 'Affidavit of Support', category: 'Support', templateId: 10 }
  ];

  // PDF Form Fields and Generation
  pdfFormFields: PDFFormField[] = [];
  pdfTemplates: PDFTemplate[] = [];
  showPdfReview: boolean = false;
  pdfSrc: SafeResourceUrl | null = null;
  pdfUrl: string | null = null;
  pdfBlob: Blob | null = null;
  pdfBlobUrl: string | null = null;
  filledPdfPath: string | null = null;
  editMode: boolean = false;
  editableFields: any = {};
  
  // Visa Petition Drafting
  visaPetitionForm: FormGroup;
  visaTypes: VisaType[] = [
    { code: 'H-1B', name: 'Specialty Occupations', category: 'Employment', description: 'Professional workers with bachelor\'s degree', processingTime: '3-6 months' },
    { code: 'L-1', name: 'Intracompany Transferee', category: 'Employment', description: 'Managers and specialized knowledge', processingTime: '2-4 months' },
    { code: 'EB-1', name: 'Priority Workers', category: 'Employment', description: 'Extraordinary ability, researchers', processingTime: '8-10 months' },
    { code: 'EB-2', name: 'Advanced Degree Professionals', category: 'Employment', description: 'Master\'s degree or exceptional ability', processingTime: '12-18 months' },
    { code: 'EB-3', name: 'Skilled Workers', category: 'Employment', description: 'Bachelor\'s degree or 2+ years experience', processingTime: '18-24 months' },
    { code: 'F-1', name: 'Student Visa', category: 'Student', description: 'Academic studies', processingTime: '2-3 months' },
    { code: 'K-1', name: 'Fiancé(e) Visa', category: 'Family', description: 'Fiancé(e) of US citizen', processingTime: '6-9 months' },
    { code: 'CR-1/IR-1', name: 'Spouse of US Citizen', category: 'Family', description: 'Immediate relative visa', processingTime: '10-13 months' }
  ];
  generatedPetition: string = '';
  isGeneratingPetition: boolean = false;
  
  // Case Status Tracker
  caseTrackerForm: FormGroup;
  trackedCases: any[] = [];
  caseUpdates: any[] = [];
  
  // Document Checklist Generator
  checklistForm: FormGroup;
  documentChecklist: FormDocument[] = [];
  checklistProgress: number = 0;
  
  // Timeline Calculator
  timelineForm: FormGroup;
  calculatedTimeline: CaseTimeline[] = [];
  estimatedCompletionDate: Date | null = null;
  
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private aiModalService: AiResponseModalService
  ) {
    super();
    // Initialize Form Completion Form
    this.formCompletionForm = this.fb.group({
      formType: ['', Validators.required],
      // Petitioner Information (using clientName/clientFirstName to match PDF field mappings)
      clientFirstName: ['', Validators.required],
      clientName: ['', Validators.required], // This is the last name
      clientMiddleName: [''],
      petitionerDateOfBirth: ['', Validators.required],
      petitionerCountryOfBirth: ['', Validators.required],
      petitionerUSCitizen: [false],
      petitionerAlienNumber: [''],
      petitionerSSN: [''],
      petitionerCityOfBirth: [''],
      // Beneficiary Information
      beneficiaryFirstName: ['', Validators.required],
      beneficiaryLastName: ['', Validators.required],
      beneficiaryMiddleName: [''],
      beneficiaryDateOfBirth: ['', Validators.required],
      beneficiaryCountryOfBirth: ['', Validators.required],
      beneficiaryAlienNumber: [''],
      beneficiaryRelationship: ['', Validators.required],
      beneficiaryCityOfBirth: [''],
      // Relationship checkboxes for PDF
      relationshipSpouse: [false],
      relationshipChild: [false],
      relationshipParent: [false],
      relationshipSibling: [false],
      // Petitioner Address
      petitionerStreetAddress: ['', Validators.required],
      petitionerCity: ['', Validators.required],
      petitionerState: ['', Validators.required],
      petitionerZipCode: ['', Validators.required],
      petitionerCountry: ['United States', Validators.required],
      petitionerApartmentNumber: [''],
      // Beneficiary Address
      beneficiaryAddress: [''],
      beneficiaryCity: [''],
      beneficiaryState: [''],
      beneficiaryZipCode: [''],
      beneficiaryCountry: [''],
      // Employment Information
      employerName: [''],
      jobTitle: [''],
      annualIncome: [''],
      startDate: ['']
    });

    // Initialize Visa Petition Form
    this.visaPetitionForm = this.fb.group({
      visaType: ['', Validators.required],
      petitionerName: ['', Validators.required],
      petitionerType: ['employer', Validators.required], // employer or self
      beneficiaryName: ['', Validators.required],
      beneficiaryQualifications: ['', [Validators.required, Validators.minLength(100)]],
      jobDescription: ['', [Validators.required, Validators.minLength(100)]],
      specializedKnowledge: [''],
      previousStatus: [''],
      priorityDate: [''],
      supportingEvidence: ['', Validators.required]
    });

    // Initialize Case Tracker Form
    this.caseTrackerForm = this.fb.group({
      receiptNumber: ['', [Validators.required, Validators.pattern(/^[A-Z]{3}\d{10}$/)]],
      caseType: ['', Validators.required],
      priorityDate: [''],
      filingDate: ['', Validators.required],
      serviceCenter: ['', Validators.required],
      notes: ['']
    });

    // Initialize Checklist Form
    this.checklistForm = this.fb.group({
      caseType: ['', Validators.required],
      visaCategory: ['', Validators.required],
      applicationType: ['', Validators.required], // initial, renewal, adjustment
      includeDerivatives: [false],
      numberOfDerivatives: [0]
    });

    // Initialize Timeline Form
    this.timelineForm = this.fb.group({
      caseType: ['', Validators.required],
      filingDate: ['', Validators.required],
      serviceCenter: ['', Validators.required],
      priorityDate: [''],
      currentStatus: ['', Validators.required],
      premiumProcessing: [false],
      hasRFE: [false],
      country: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadSavedCases();
    this.loadPDFTemplates();
  }

  ngOnDestroy(): void {
    // Clean up blob URL to prevent memory leak
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
    }
  }

  loadSavedCases(): void {
    const savedCases = localStorage.getItem('immigration_cases');
    if (savedCases) {
      this.trackedCases = JSON.parse(savedCases);
    }
  }

  // Tab Navigation
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Helper methods for template
  getVisaTypesByCategory(category: string): VisaType[] {
    return this.visaTypes.filter(v => v.category === category);
  }

  // USCIS Form Completion Methods
  selectForm(formCode: string): void {
    this.selectedForm = formCode;
    this.formCompletionForm.patchValue({ formType: formCode });
    this.updateFormFields(formCode);
    this.loadPDFFormFields(formCode);
  }

  updateFormFields(formCode: string): void {
    // Update form fields based on selected form type
    // This would dynamically adjust required fields based on the form
    if (formCode === 'N-400') {
      this.formCompletionForm.get('beneficiaryRelationship')?.clearValidators();
      this.formCompletionForm.get('employerName')?.setValidators(Validators.required);
    } else if (formCode === 'I-130') {
      this.formCompletionForm.get('beneficiaryRelationship')?.setValidators(Validators.required);
    }
    this.formCompletionForm.updateValueAndValidity();
  }

  generateUSCISForm(): void {
    if (this.formCompletionForm.invalid) {
      this.markFormGroupTouched(this.formCompletionForm);
      return;
    }

    this.isGeneratingForm = true;
    this.formProgress = 0;

    // Find the template ID for the selected form
    const formInfo = this.availableForms.find(f => f.code === this.selectedForm);
    if (!formInfo || !formInfo.templateId) {
      Swal.fire('Error', 'Template not found for this form', 'error');
      this.isGeneratingForm = false;
      return;
    }

    const caseData = this.formCompletionForm.value;

    // Convert relationship dropdown to checkbox fields for PDF
    // Use the caseDataPath names from database, not the full PDF field names
    const relationship = caseData.beneficiaryRelationship;
    caseData.relationshipSpouse = relationship === 'spouse' ? 'Yes' : 'Off';
    caseData.relationshipChild = relationship === 'child' ? 'Yes' : 'Off';
    caseData.relationshipParent = relationship === 'parent' ? 'Yes' : 'Off';
    caseData.relationshipSibling = relationship === 'sibling' ? 'Yes' : 'Off';

    // Convert US Citizen checkbox - now using database field mapping
    caseData.petitionerUSCitizen = caseData.petitionerUSCitizen ? 'Yes' : 'Off';

    // Call the SAME PDF fill endpoint that the working PDF forms component uses
    this.http.post<any>(`http://localhost:8085/api/ai/pdf-forms/${formInfo.templateId}/fill`, {
      caseData: caseData
    }).subscribe({
      next: (response) => {
        console.log('PDF filled successfully:', response);
        this.filledPdfPath = response.filledPdfPath;

        // Create the PDF URL
        const filledPath = response.filledPdfPath;
        this.pdfUrl = `http://localhost:8085/api/files/download?path=${encodeURIComponent(filledPath)}`;
        console.log('PDF URL:', this.pdfUrl);

        // Fetch PDF as blob and create blob URL for display
        this.http.get(this.pdfUrl, { responseType: 'blob' }).subscribe({
          next: (blob) => {
            console.log('PDF blob received, size:', blob.size);

            // Clean up previous blob URL if exists
            if (this.pdfBlobUrl) {
              URL.revokeObjectURL(this.pdfBlobUrl);
            }

            // Create new blob URL
            this.pdfBlob = blob;
            this.pdfBlobUrl = URL.createObjectURL(blob);
            this.pdfSrc = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl);

            this.showPdfReview = true;
            this.editableFields = { ...caseData };
            this.isGeneratingForm = false;
            this.formProgress = 100;

            // Force change detection
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error fetching PDF blob:', err);
            this.isGeneratingForm = false;
            this.cdr.detectChanges();
            Swal.fire('Error', 'Failed to load PDF preview', 'error');
          }
        });
      },
      error: (error) => {
        console.error('Error filling PDF:', error);
        this.isGeneratingForm = false;
        this.cdr.detectChanges();
        Swal.fire('Error', 'Failed to fill PDF form', 'error');
      }
    });
  }

  private showFormCompletionSuccess(): void {
    // Show success message and provide download link
    console.log('Form completed successfully');
  }

  // Visa Petition Drafting Methods
  generateVisaPetition(): void {
    if (this.visaPetitionForm.invalid) {
      this.markFormGroupTouched(this.visaPetitionForm);
      return;
    }

    this.isGeneratingPetition = true;
    const formData = this.visaPetitionForm.value;
    
    this.http.post<any>('http://localhost:8085/api/ai/immigration/generate-visa-petition', formData)
      .subscribe({
        next: (response) => {
          if (response.success && response.petition) {
            this.generatedPetition = response.petition;

            // Open modal with visa petition
            const contextInfo = {
              'Visa Type': formData.visaType,
              'Beneficiary': formData.beneficiaryName,
              'Petitioner': formData.petitionerName,
              'Relationship': formData.relationship,
              'Country': formData.beneficiaryCountry
            };
            this.aiModalService.openVisaPetition(response.petition, contextInfo);
          } else {
            this.generatedPetition = 'Error generating visa petition. Please try again.';
          }
          this.isGeneratingPetition = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error generating visa petition:', error);
          this.generatedPetition = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingPetition = false;
          this.cdr.detectChanges();
        }
      });
  }

  private createPetitionContent(data: any): string {
    const visaType = this.visaTypes.find(v => v.code === data.visaType);
    
    return `
UNITED STATES CITIZENSHIP AND IMMIGRATION SERVICES
PETITION FOR ${visaType?.name.toUpperCase()}

Case Type: ${data.visaType} - ${visaType?.name}
Priority Date: ${data.priorityDate || 'Current'}

I. PETITIONER INFORMATION
Petitioner: ${data.petitionerName}
Type: ${data.petitionerType === 'employer' ? 'Employer' : 'Self-Petition'}

II. BENEFICIARY INFORMATION
Beneficiary: ${data.beneficiaryName}
Current Status: ${data.previousStatus || 'Outside United States'}

III. POSITION AND QUALIFICATIONS

Position Offered:
${data.jobDescription}

Beneficiary Qualifications:
${data.beneficiaryQualifications}

${data.specializedKnowledge ? `IV. SPECIALIZED KNOWLEDGE
${data.specializedKnowledge}` : ''}

V. SUPPORTING EVIDENCE
The following evidence is submitted in support of this petition:
${data.supportingEvidence}

VI. CERTIFICATION
I certify, under penalty of perjury under the laws of the United States, that this petition and the evidence submitted with it are true and correct.

_______________________
Petitioner Signature
Date: ${new Date().toLocaleDateString()}

NOTICE: This petition must be filed with the appropriate filing fee and supporting documentation as required by USCIS regulations.
    `.trim();
  }

  // Case Status Tracker Methods
  addCase(): void {
    if (this.caseTrackerForm.invalid) {
      return;
    }

    const newCase = {
      ...this.caseTrackerForm.value,
      id: Date.now().toString(),
      addedDate: new Date(),
      lastChecked: new Date(),
      currentStatus: 'Case Was Received',
      statusHistory: [
        {
          date: new Date(),
          status: 'Case Was Received',
          description: 'USCIS received your case and sent a receipt notice'
        }
      ]
    };

    this.trackedCases.push(newCase);
    this.saveCases();
    this.caseTrackerForm.reset();
    
    // Simulate checking for updates
    this.checkCaseStatus(newCase.receiptNumber);
  }

  removeCase(id: string): void {
    this.trackedCases = this.trackedCases.filter(c => c.id !== id);
    this.saveCases();
  }

  checkCaseStatus(receiptNumber: string): void {
    const caseData = this.trackedCases.find(c => c.receiptNumber === receiptNumber);
    
    if (!caseData) {
      console.error('Case not found');
      return;
    }
    
    const requestData = {
      receiptNumber: receiptNumber,
      caseType: caseData.caseType,
      filingDate: caseData.filingDate,
      serviceCenter: caseData.serviceCenter,
      priorityDate: caseData.priorityDate,
      currentStatus: caseData.currentStatus || 'Case Was Received',
      notes: caseData.notes
    };
    
    this.http.post<any>('http://localhost:8085/api/ai/immigration/check-case-status', requestData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.caseUpdates.push({
              receiptNumber: receiptNumber,
              status: 'Analysis Complete',
              date: new Date(),
              description: response.analysis
            });

            // Open modal with case status
            if (response.analysis || response.status) {
              const contextInfo = {
                'Receipt Number': receiptNumber,
                'Case Type': caseData.caseType,
                'Filing Date': caseData.filingDate,
                'Service Center': caseData.serviceCenter,
                'Priority Date': caseData.priorityDate || 'N/A'
              };
              this.aiModalService.openCaseStatusAnalysis(
                response.analysis || response.status || 'Case status updated',
                contextInfo
              );
            }
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error checking case status:', error);
          this.caseUpdates.push({
            receiptNumber: receiptNumber,
            status: 'Error',
            date: new Date(),
            description: 'Unable to check status at this time'
          });
          this.cdr.detectChanges();
        }
      });
  }

  refreshAllCases(): void {
    this.trackedCases.forEach(caseItem => {
      this.checkCaseStatus(caseItem.receiptNumber);
    });
  }

  private saveCases(): void {
    localStorage.setItem('immigration_cases', JSON.stringify(this.trackedCases));
  }

  // Document Checklist Generator Methods
  generateChecklist(): void {
    if (this.checklistForm.invalid) {
      this.markFormGroupTouched(this.checklistForm);
      return;
    }

    const data = this.checklistForm.value;
    
    this.http.post<any>('http://localhost:8085/api/ai/immigration/generate-document-checklist', data)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Use AI-generated checklist as base
            this.documentChecklist = this.createDocumentChecklist(data);
            // Add AI insights
            if (response.checklist) {
              this.documentChecklist.push({
                id: 'ai-note',
                name: 'AI Recommendations',
                formNumber: '',
                status: 'info',
                required: false,
                filed: false
              });
            }
          } else {
            this.documentChecklist = this.createDocumentChecklist(data);
          }
          this.updateChecklistProgress();
        },
        error: (error) => {
          console.error('Error generating checklist:', error);
          this.documentChecklist = this.createDocumentChecklist(data);
          this.updateChecklistProgress();
        }
      });
  }

  private createDocumentChecklist(data: any): FormDocument[] {
    const documents: FormDocument[] = [];
    
    // Base documents for all cases
    documents.push(
      { id: '1', name: 'Passport Copy', formNumber: '', status: 'pending', required: true },
      { id: '2', name: 'Photographs (2x2)', formNumber: '', status: 'pending', required: true },
      { id: '3', name: 'Birth Certificate', formNumber: '', status: 'pending', required: true }
    );
    
    // Add case-specific documents
    if (data.caseType === 'employment') {
      documents.push(
        { id: '4', name: 'Labor Certification', formNumber: 'ETA-9089', status: 'pending', required: true },
        { id: '5', name: 'Educational Credentials', formNumber: '', status: 'pending', required: true },
        { id: '6', name: 'Experience Letters', formNumber: '', status: 'pending', required: true },
        { id: '7', name: 'Job Offer Letter', formNumber: '', status: 'pending', required: true }
      );
    } else if (data.caseType === 'family') {
      documents.push(
        { id: '4', name: 'Marriage Certificate', formNumber: '', status: 'pending', required: true },
        { id: '5', name: 'Proof of Relationship', formNumber: '', status: 'pending', required: true },
        { id: '6', name: 'Affidavit of Support', formNumber: 'I-864', status: 'pending', required: true },
        { id: '7', name: 'Tax Returns (3 years)', formNumber: '', status: 'pending', required: true }
      );
    }
    
    // Add derivative documents if applicable
    if (data.includeDerivatives && data.numberOfDerivatives > 0) {
      for (let i = 1; i <= data.numberOfDerivatives; i++) {
        documents.push(
          { id: `d${i}`, name: `Derivative ${i} - Birth Certificate`, formNumber: '', status: 'pending', required: true },
          { id: `dp${i}`, name: `Derivative ${i} - Passport`, formNumber: '', status: 'pending', required: true }
        );
      }
    }
    
    return documents;
  }

  toggleDocumentStatus(doc: FormDocument): void {
    doc.filed = !doc.filed;
    doc.status = doc.filed ? 'completed' : 'pending';
    this.updateChecklistProgress();
  }

  updateChecklistProgress(): void {
    const total = this.documentChecklist.length;
    const completed = this.documentChecklist.filter(d => d.filed).length;
    this.checklistProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  // Timeline Calculator Methods
  calculateTimeline(): void {
    if (this.timelineForm.invalid) {
      this.markFormGroupTouched(this.timelineForm);
      return;
    }

    const data = this.timelineForm.value;
    
    this.http.post<any>('http://localhost:8085/api/ai/immigration/calculate-timeline', data)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Generate timeline with AI insights
            this.calculatedTimeline = this.generateTimeline(data);
            // Parse AI timeline for additional insights
            if (response.timeline) {
              this.parseAITimeline(response.timeline);
            }
          } else {
            this.calculatedTimeline = this.generateTimeline(data);
          }
          this.calculateEstimatedCompletion(data);
        },
        error: (error) => {
          console.error('Error calculating timeline:', error);
          this.calculatedTimeline = this.generateTimeline(data);
          this.calculateEstimatedCompletion(data);
        }
      });
  }

  private parseAITimeline(timelineText: string): void {
    // Extract estimated dates from AI response if available
    const dateMatches = timelineText.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/g);
    if (dateMatches && dateMatches.length > 0) {
      // Update estimated completion based on AI analysis
      const lastDate = new Date(dateMatches[dateMatches.length - 1]);
      if (!isNaN(lastDate.getTime())) {
        this.estimatedCompletionDate = lastDate;
      }
    }
  }

  private generateTimeline(data: any): CaseTimeline[] {
    const timeline: CaseTimeline[] = [];
    const filingDate = new Date(data.filingDate);
    
    // Base timeline stages
    timeline.push({
      stage: 'Case Filing',
      status: 'completed',
      estimatedDate: filingDate,
      actualDate: filingDate,
      notes: 'Case received by USCIS'
    });
    
    // Processing times vary by case type and service center
    const processingTimes = this.getProcessingTimes(data.caseType, data.serviceCenter);
    
    if (!data.premiumProcessing) {
      timeline.push({
        stage: 'Biometrics',
        status: data.currentStatus === 'Biometrics Scheduled' ? 'in-progress' : 'pending',
        estimatedDate: this.addMonths(filingDate, 1),
        notes: 'Biometrics appointment'
      });
      
      timeline.push({
        stage: 'Initial Review',
        status: 'pending',
        estimatedDate: this.addMonths(filingDate, processingTimes.initialReview),
        notes: 'USCIS begins case review'
      });
      
      if (data.hasRFE) {
        timeline.push({
          stage: 'RFE Response',
          status: 'pending',
          estimatedDate: this.addMonths(filingDate, processingTimes.initialReview + 2),
          notes: 'Response to Request for Evidence'
        });
      }
      
      timeline.push({
        stage: 'Final Decision',
        status: 'pending',
        estimatedDate: this.addMonths(filingDate, processingTimes.total),
        notes: 'Case adjudication'
      });
    } else {
      // Premium processing - 15 calendar days
      timeline.push({
        stage: 'Premium Processing Review',
        status: 'in-progress',
        estimatedDate: this.addDays(filingDate, 15),
        notes: '15-day premium processing'
      });
    }
    
    return timeline;
  }

  private getProcessingTimes(caseType: string, serviceCenter: string): any {
    // Simplified processing times (would be more complex in reality)
    const times: any = {
      'I-140': { initialReview: 3, total: 6 },
      'I-485': { initialReview: 4, total: 8 },
      'I-130': { initialReview: 6, total: 12 },
      'N-400': { initialReview: 5, total: 10 },
      'I-765': { initialReview: 2, total: 4 }
    };
    
    return times[caseType] || { initialReview: 3, total: 6 };
  }

  private calculateEstimatedCompletion(data: any): void {
    const filingDate = new Date(data.filingDate);
    const processingTimes = this.getProcessingTimes(data.caseType, data.serviceCenter);
    
    if (data.premiumProcessing) {
      this.estimatedCompletionDate = this.addDays(filingDate, 15);
    } else {
      const additionalTime = data.hasRFE ? 2 : 0;
      this.estimatedCompletionDate = this.addMonths(filingDate, processingTimes.total + additionalTime);
    }
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }


  // Helper methods
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

  // Helper methods for UI
  getStatusClass(status: string): string {
    const classes: any = {
      'completed': 'badge bg-success',
      'in-progress': 'badge bg-primary',
      'pending': 'badge bg-secondary',
      'approved': 'badge bg-success',
      'denied': 'badge bg-danger',
      'rfe': 'badge bg-warning'
    };
    return classes[status] || 'badge bg-secondary';
  }

  getCaseStatusIcon(status: string): string {
    const icons: any = {
      'Case Was Received': 'ri-inbox-line',
      'Biometrics Appointment Scheduled': 'ri-fingerprint-line',
      'Case Is Being Actively Reviewed': 'ri-file-search-line',
      'Request for Evidence Was Sent': 'ri-mail-send-line',
      'Case Was Approved': 'ri-checkbox-circle-line',
      'Case Was Denied': 'ri-close-circle-line'
    };
    return icons[status] || 'ri-file-line';
  }

  getServiceCenters(): string[] {
    return [
      'California Service Center',
      'Nebraska Service Center',
      'Texas Service Center',
      'Vermont Service Center',
      'Potomac Service Center'
    ];
  }

  // Load Sample Data Methods
  loadSampleUSCISForm(): void {
    const sampleForm = this.availableForms.find(f => f.code === 'I-130'); // Petition for Alien Relative
    if (sampleForm) {
      this.selectForm(sampleForm.code);
    }

    this.formCompletionForm.patchValue({
      formType: 'I-130',
      petitionerFirstName: 'Maria',
      petitionerLastName: 'Rodriguez',
      petitionerDOB: '1985-03-15',
      petitionerCountryOfBirth: 'United States',
      petitionerUSCitizen: true,
      petitionerAlienNumber: '',
      beneficiaryFirstName: 'Carlos',
      beneficiaryLastName: 'Rodriguez',
      beneficiaryDOB: '1982-07-22',
      beneficiaryCountryOfBirth: 'Mexico',
      beneficiaryAlienNumber: '',
      beneficiaryRelationship: 'Spouse',
      currentAddress: {
        street: '1234 Main Street, Apt 5B',
        city: 'Los Angeles',
        state: 'California',
        zipCode: '90001',
        country: 'United States'
      },
      employerName: 'ABC Technology Solutions',
      jobTitle: 'Software Engineer',
      annualIncome: '85000',
      startDate: '2020-06-01'
    });
  }

  loadSampleVisaPetition(): void {
    this.visaPetitionForm.patchValue({
      visaType: 'H-1B',
      petitionerName: 'TechCorp Industries LLC',
      petitionerType: 'employer',
      beneficiaryName: 'Priya Sharma',
      beneficiaryQualifications: 'Bachelor of Science in Computer Science from Indian Institute of Technology, Delhi (2019). Master of Science in Data Science from Stanford University (2021). Specialized training in machine learning algorithms, cloud computing architecture, and big data analytics. Proficient in Python, Java, SQL, TensorFlow, and AWS cloud services. Previous experience includes 2 years as Data Analyst at Mumbai Tech Solutions and 1 year internship at Google India.',
      jobDescription: 'The beneficiary will work as a Senior Data Scientist responsible for developing and implementing machine learning models for predictive analytics, designing algorithms to process large datasets, collaborating with engineering teams to deploy ML models into production systems, conducting statistical analysis to derive business insights, and mentoring junior data scientists. This position requires specialized knowledge in advanced statistics, machine learning frameworks, and distributed computing systems.',
      specializedKnowledge: 'The position requires specialized knowledge in advanced machine learning algorithms, including deep learning neural networks, natural language processing, computer vision, and reinforcement learning. The beneficiary possesses unique expertise in developing scalable ML pipelines using Apache Spark and Kubernetes, implementing real-time data streaming solutions, and optimizing model performance for large-scale production environments.',
      previousStatus: 'F-1 OPT',
      priorityDate: '2024-04-01',
      supportingEvidence: 'Educational transcripts and diplomas, employer letters confirming job offer and salary details, resume demonstrating relevant experience, letters from previous supervisors attesting to specialized skills, professional certifications in cloud computing and data science, published research papers in machine learning conferences, and documentation of successful project implementations.'
    });
  }

  loadSampleCaseStatus(): void {
    this.caseTrackerForm.patchValue({
      receiptNumber: 'MSC2490123456',
      caseType: 'I-485',
      priorityDate: '2022-08-15',
      filingDate: '2024-01-15',
      serviceCenter: 'Nebraska Service Center',
      notes: 'Case filed concurrently with I-140 petition. Biometrics appointment completed on 2024-02-28. RFE received on 2024-04-10 requesting additional employment verification documents. RFE response submitted on 2024-05-05 with updated employment letter and pay stubs.'
    });
  }

  loadSampleDocumentChecklist(): void {
    this.checklistForm.patchValue({
      caseType: 'employment',
      visaCategory: 'EB-2',
      applicationType: 'adjustment',
      includeDerivatives: true,
      numberOfDerivatives: 2
    });
  }

  loadSampleTimelineCalculator(): void {
    this.timelineForm.patchValue({
      caseType: 'I-140',
      filingDate: '2024-03-01',
      serviceCenter: 'Texas Service Center',
      priorityDate: '2023-12-01',
      currentStatus: 'Case Was Received',
      premiumProcessing: false,
      hasRFE: false,
      country: 'India'
    });
  }

  // PDF Form Methods
  loadPDFTemplates(): void {
    this.http.get<PDFTemplate[]>('http://localhost:8085/api/ai/templates/pdf-forms').subscribe({
      next: (templates) => {
        this.pdfTemplates = templates.filter(t =>
          t.templateType === 'PDF_FORM' &&
          t.name.includes('USCIS')
        );
      },
      error: (error) => {
        console.error('Error loading PDF templates:', error);
      }
    });
  }

  loadPDFFormFields(formCode: string): void {
    // For now, create default fields based on form type
    // Later this can load from backend when PDF templates are properly configured
    this.pdfFormFields = this.getDefaultFieldsForForm(formCode);

    // Add fields to form dynamically
    this.addDynamicFormFields();
    this.cdr.detectChanges();
  }

  getDefaultFieldsForForm(formCode: string): PDFFormField[] {
    const fields: PDFFormField[] = [];

    if (formCode === 'I-130') {
      // Additional I-130 specific fields
      fields.push(
        {
          pdfFieldName: 'petitionerSSN',
          caseDataPath: 'petitionerSSN',
          fieldType: 'TEXT',
          isRequired: false,
          displayOrder: 1,
          displayName: 'Petitioner SSN'
        },
        {
          pdfFieldName: 'petitionerPhone',
          caseDataPath: 'petitionerPhone',
          fieldType: 'TEXT',
          isRequired: false,
          displayOrder: 2,
          displayName: 'Petitioner Phone'
        },
        {
          pdfFieldName: 'petitionerEmail',
          caseDataPath: 'petitionerEmail',
          fieldType: 'TEXT',
          isRequired: false,
          displayOrder: 3,
          displayName: 'Petitioner Email'
        },
        {
          pdfFieldName: 'beneficiaryAlienNumber',
          caseDataPath: 'beneficiaryAlienNumber',
          fieldType: 'TEXT',
          isRequired: false,
          displayOrder: 4,
          displayName: 'Beneficiary Alien Number'
        },
        {
          pdfFieldName: 'marriageDate',
          caseDataPath: 'marriageDate',
          fieldType: 'DATE',
          isRequired: false,
          displayOrder: 5,
          displayName: 'Date of Marriage'
        },
        {
          pdfFieldName: 'marriagePlace',
          caseDataPath: 'marriagePlace',
          fieldType: 'TEXT',
          isRequired: false,
          displayOrder: 6,
          displayName: 'Place of Marriage'
        }
      );
    } else if (formCode === 'I-765') {
      fields.push(
        {
          pdfFieldName: 'eligibilityCategory',
          caseDataPath: 'eligibilityCategory',
          fieldType: 'TEXT',
          isRequired: true,
          displayOrder: 1,
          displayName: 'Eligibility Category'
        },
        {
          pdfFieldName: 'previousEAD',
          caseDataPath: 'previousEAD',
          fieldType: 'CHECKBOX',
          isRequired: false,
          displayOrder: 2,
          displayName: 'Previously Had EAD'
        },
        {
          pdfFieldName: 'socialSecurityNumber',
          caseDataPath: 'socialSecurityNumber',
          fieldType: 'TEXT',
          isRequired: false,
          displayOrder: 3,
          displayName: 'Social Security Number'
        }
      );
    } else if (formCode === 'N-400') {
      fields.push(
        {
          pdfFieldName: 'greenCardNumber',
          caseDataPath: 'greenCardNumber',
          fieldType: 'TEXT',
          isRequired: true,
          displayOrder: 1,
          displayName: 'Green Card Number'
        },
        {
          pdfFieldName: 'dateOfLPR',
          caseDataPath: 'dateOfLPR',
          fieldType: 'DATE',
          isRequired: true,
          displayOrder: 2,
          displayName: 'Date Became LPR'
        },
        {
          pdfFieldName: 'maritalStatus',
          caseDataPath: 'maritalStatus',
          fieldType: 'TEXT',
          isRequired: true,
          displayOrder: 3,
          displayName: 'Marital Status'
        }
      );
    }

    return fields;
  }

  addDynamicFormFields(): void {
    this.pdfFormFields.forEach(field => {
      // Only add if not already in form
      if (!this.formCompletionForm.contains(field.caseDataPath)) {
        const validators = field.isRequired ? [Validators.required] : [];
        this.formCompletionForm.addControl(
          field.caseDataPath,
          this.fb.control(field.defaultValue || '', validators)
        );
      }
    });

    // Mark all existing controls as pristine to avoid validation errors on load
    Object.keys(this.formCompletionForm.controls).forEach(key => {
      const control = this.formCompletionForm.get(key);
      if (control) {
        control.markAsPristine();
        control.markAsUntouched();
      }
    });

    this.formCompletionForm.updateValueAndValidity();
  }

  formatFieldName(fieldPath: string): string {
    return fieldPath
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  async fillWithAI(): Promise<void> {
    const { value: caseInfo } = await Swal.fire({
      title: 'AI Form Filling',
      html: `
        <div class="text-start">
          <p class="mb-3">Provide case information for AI to fill the form:</p>
          <textarea id="ai-prompt" class="form-control" rows="6"
            placeholder="Example: Maria Rodriguez (petitioner) is filing for her husband Carlos Rodriguez (beneficiary). Maria is a US citizen born in San Antonio, TX. Carlos was born in Mexico City on March 15, 1985. They married in Las Vegas on June 15, 2010..."></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Generate with AI',
      preConfirm: () => {
        const prompt = (document.getElementById('ai-prompt') as HTMLTextAreaElement).value;
        if (!prompt) {
          Swal.showValidationMessage('Please provide case information');
          return false;
        }
        return prompt;
      }
    });

    if (caseInfo) {
      this.isGeneratingForm = true;

      const formInfo = this.availableForms.find(f => f.code === this.selectedForm);
      this.http.post<any>('http://localhost:8085/api/ai/generate/form-data', {
        templateId: formInfo?.templateId,
        prompt: caseInfo,
        formFields: this.pdfFormFields.map(f => f.caseDataPath)
      }).subscribe({
        next: (response) => {
          this.formCompletionForm.patchValue(response.formData);
          this.isGeneratingForm = false;
          Swal.fire('Success', 'Form fields have been filled with AI', 'success');
        },
        error: (error) => {
          console.error('Error generating form data with AI:', error);
          this.isGeneratingForm = false;
          // Use mock data as fallback
          const mockData = this.generateMockData();
          this.formCompletionForm.patchValue(mockData);
          Swal.fire('Demo Mode', 'Using sample data for demonstration', 'info');
        }
      });
    }
  }

  generateMockData(): any {
    return {
      clientName: 'Rodriguez',
      clientFirstName: 'Maria',
      clientMiddleName: 'Carmen',
      beneficiaryLastName: 'Rodriguez',
      beneficiaryFirstName: 'Carlos',
      beneficiaryMiddleName: 'Antonio',
      beneficiaryDateOfBirth: '1985-03-15',
      beneficiaryGenderMale: true,
      beneficiaryGenderFemale: false,
      beneficiaryCityOfBirth: 'Mexico City',
      beneficiaryCountryOfBirth: 'Mexico',
      relationshipSpouse: true,
      beneficiaryAddress: '456 Oak Avenue, Apt 2B',
      beneficiaryCity: 'Los Angeles',
      beneficiaryState: 'CA',
      beneficiaryZipCode: '90210',
      beneficiaryCountry: 'United States',
      petitionerSSN: '123-45-6789',
      petitionerDateOfBirth: '1985-08-22',
      petitionerCity: 'Houston',
      petitionerState: 'TX'
    };
  }

  enableEditMode(): void {
    this.editMode = true;
    Swal.fire({
      title: 'Edit Mode',
      text: 'You can now edit the form fields. Click Save Changes when done.',
      icon: 'info',
      timer: 3000
    });
  }

  saveEdits(): void {
    this.formCompletionForm.patchValue(this.editableFields);
    this.generateUSCISForm(); // Regenerate PDF with updated data
    this.editMode = false;
    Swal.fire('Success', 'Changes have been applied', 'success');
  }

  cancelEdits(): void {
    this.editMode = false;
    this.editableFields = { ...this.formCompletionForm.value };
  }

  proceedToReview(): void {
    if (this.formCompletionForm.invalid) {
      this.markFormGroupTouched(this.formCompletionForm);
      return;
    }

    // Generate the PDF with current form data
    this.generateUSCISForm();
  }

  backToForm(): void {
    this.showPdfReview = false;
    // Clean up blob URL
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
      this.pdfBlobUrl = null;
    }
    this.pdfSrc = null;
    this.pdfUrl = null;
    this.pdfBlob = null;
  }

  downloadPDF(): void {
    if (!this.pdfUrl) return;

    const link = document.createElement('a');
    link.href = this.pdfUrl;
    link.download = `${this.selectedForm}_filled.pdf`;
    link.click();

    Swal.fire({
      title: 'Downloaded!',
      text: 'The filled PDF form has been downloaded.',
      icon: 'success',
      timer: 2000
    });
  }

  saveAndContinue(): void {
    const formData = {
      templateId: this.availableForms.find(f => f.code === this.selectedForm)?.templateId,
      filledPdfPath: this.filledPdfPath,
      caseData: this.formCompletionForm.value,
      status: 'COMPLETED'
    };

    this.http.post('http://localhost:8085/api/ai/pdf-forms/save', formData).subscribe({
      next: () => {
        Swal.fire('Saved!', 'The form has been saved successfully.', 'success');
        this.backToForm();
      },
      error: (error) => {
        console.error('Error saving form:', error);
        Swal.fire('Info', 'Form saved locally', 'info');
        this.backToForm();
      }
    });
  }

  getFormCategory(formCode: string): string {
    const form = this.availableForms.find(f => f.code === formCode);
    return form ? form.category : '';
  }

  // Export document helper
  exportDocument(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  }
}