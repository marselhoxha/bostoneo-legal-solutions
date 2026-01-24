import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PracticeAreaBaseComponent } from '../../shared/practice-area-base.component';
import { AiResponseFormatterPipe } from '../../shared/ai-response-formatter.pipe';
import { AiResponseModalService } from '../../shared/services/ai-response-modal.service';
import { environment } from '../../../../../../../environments/environment';

interface PatentClaim {
  id: string;
  claimNumber: number;
  claimText: string;
  type: string; // independent or dependent
  dependsOn?: number;
}

interface PriorArtResult {
  id: string;
  title: string;
  publicationNumber: string;
  publicationDate: Date;
  relevance: string;
  abstract: string;
  similarity: number;
}

interface TrademarkClass {
  classNumber: number;
  description: string;
  selected: boolean;
}

@Component({
  selector: 'app-intellectual-property',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, AiResponseFormatterPipe],
  templateUrl: './intellectual-property.component.html',
  styleUrls: ['./intellectual-property.component.scss']
})
export class IntellectualPropertyComponent extends PracticeAreaBaseComponent implements OnInit {
  activeTab: string = 'patent-application';
  
  // Patent Application Drafting
  patentForm: FormGroup;
  patentClaims: PatentClaim[] = [];
  generatedApplication: string = '';
  isGeneratingPatent: boolean = false;
  patentTypes = [
    { value: 'utility', label: 'Utility Patent' },
    { value: 'design', label: 'Design Patent' },
    { value: 'plant', label: 'Plant Patent' },
    { value: 'provisional', label: 'Provisional Application' }
  ];
  
  // Trademark Search
  trademarkForm: FormGroup;
  trademarkResults: any[] = [];
  isSearchingTrademark: boolean = false;
  trademarkClasses: TrademarkClass[] = [];
  
  // Copyright Registration
  copyrightForm: FormGroup;
  generatedCopyright: string = '';
  isGeneratingCopyright: boolean = false;
  workTypes = [
    { value: 'literary', label: 'Literary Work' },
    { value: 'musical', label: 'Musical Work' },
    { value: 'dramatic', label: 'Dramatic Work' },
    { value: 'audiovisual', label: 'Motion Picture/Audiovisual' },
    { value: 'sound', label: 'Sound Recording' },
    { value: 'architectural', label: 'Architectural Work' },
    { value: 'visual', label: 'Visual Arts' },
    { value: 'software', label: 'Computer Software' }
  ];
  
  // Prior Art Search
  priorArtForm: FormGroup;
  priorArtResults: PriorArtResult[] = [];
  isSearchingPriorArt: boolean = false;
  
  // Licensing Agreement Generator
  licenseForm: FormGroup;
  generatedLicense: string = '';
  isGeneratingLicense: boolean = false;
  licenseTypes = [
    { value: 'exclusive', label: 'Exclusive License' },
    { value: 'non-exclusive', label: 'Non-Exclusive License' },
    { value: 'sole', label: 'Sole License' },
    { value: 'sublicense', label: 'Sublicense Agreement' }
  ];
  
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private aiModalService: AiResponseModalService
  ) {
    super();
    // Initialize Patent Form - Simplified validation
    this.patentForm = this.fb.group({
      patentType: ['utility', Validators.required],
      title: ['', [Validators.required, Validators.maxLength(500)]],
      // Inventors
      inventors: this.fb.array([]),
      primaryInventor: ['', Validators.required],
      inventorAddress: [''], // Made optional
      // Application Details
      fieldOfInvention: ['', [Validators.required, Validators.minLength(50)]],
      backgroundOfInvention: [''], // Made optional
      summaryOfInvention: ['', [Validators.required, Validators.minLength(50)]], // Reduced min length
      detailedDescription: [''], // Made optional
      abstract: ['', [Validators.required, Validators.maxLength(150)]],
      // Technical Fields
      technicalField: ['', Validators.required],
      problemSolved: [''], // Made optional
      advantages: [''], // Made optional
      // Prior Art References
      priorArtReferences: [''],
      relatedApplications: ['']
    });

    // Initialize Trademark Form - Simplified validation
    this.trademarkForm = this.fb.group({
      markText: ['', Validators.required],
      markType: ['wordmark', Validators.required], // wordmark, design, composite
      goodsServices: ['', [Validators.required, Validators.minLength(20)]],
      ownerName: ['', Validators.required],
      ownerType: ['individual', Validators.required], // individual, corporation, llc
      ownerAddress: [''], // Made optional
      firstUseDate: [''],
      firstUseInCommerceDate: [''],
      disclaimer: [''],
      translation: [''],
      searchScope: ['federal'] // Removed required
    });

    // Initialize Copyright Form - Simplified validation
    this.copyrightForm = this.fb.group({
      workTitle: ['', Validators.required],
      workType: ['', Validators.required],
      yearOfCreation: ['', [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear())]],
      publicationStatus: ['unpublished'],
      publicationDate: [''],
      publicationCountry: ['United States'],
      // Author Information
      authorName: ['', Validators.required],
      authorType: ['individual', Validators.required], // individual, employer, anonymous
      authorCitizenship: ['', Validators.required],
      authorDomicile: ['', Validators.required],
      workForHire: [false],
      // Claimant Information
      claimantName: ['', Validators.required],
      claimantAddress: ['', Validators.required],
      transferStatement: [''],
      // Rights
      limitationOfClaim: [''],
      preexistingMaterial: [''],
      materialExcluded: [''],
      newMaterialIncluded: ['']
    });

    // Initialize Prior Art Form
    this.priorArtForm = this.fb.group({
      inventionTitle: ['', Validators.required],
      keywords: ['', Validators.required],
      technicalField: ['', Validators.required],
      inventionDescription: ['', [Validators.required, Validators.minLength(100)]],
      searchDatabases: this.fb.group({
        uspto: [true],
        googlePatents: [true],
        espacenet: [true],
        wipo: [true],
        nonPatentLiterature: [false]
      }),
      dateRange: this.fb.group({
        startDate: [''],
        endDate: [new Date().toISOString().split('T')[0]]
      }),
      jurisdictions: ['US', Validators.required]
    });

    // Initialize License Form
    this.licenseForm = this.fb.group({
      licenseType: ['', Validators.required],
      // Parties
      licensorName: ['', Validators.required],
      licensorAddress: ['', Validators.required],
      licenseeName: ['', Validators.required],
      licenseeAddress: ['', Validators.required],
      // IP Details
      ipType: ['', Validators.required], // patent, trademark, copyright, trade-secret
      ipDescription: ['', [Validators.required, Validators.minLength(50)]],
      registrationNumbers: [''],
      // License Terms
      territory: ['', Validators.required],
      fieldOfUse: [''],
      duration: this.fb.group({
        startDate: ['', Validators.required],
        endDate: [''],
        perpetual: [false]
      }),
      // Financial Terms
      royaltyRate: [0],
      royaltyBase: ['net-sales'],
      upfrontPayment: [0],
      minimumRoyalties: [0],
      milestonePayments: [''],
      // Rights and Restrictions
      sublicenseRights: [false],
      improvementRights: ['licensor'], // licensor, licensee, joint
      qualityControl: [true],
      confidentiality: [true],
      nonCompete: [false]
    });
  }

  ngOnInit(): void {
    this.initializeTrademarkClasses();
    this.loadSavedData();
  }

  loadSavedData(): void {
    // Load saved patent claims
    const savedClaims = localStorage.getItem('ip_patentClaims');
    if (savedClaims) {
      this.patentClaims = JSON.parse(savedClaims);
    }
  }

  initializeTrademarkClasses(): void {
    // Initialize Nice Classification for trademarks (simplified)
    this.trademarkClasses = [
      { classNumber: 9, description: 'Computer software, electronics', selected: false },
      { classNumber: 25, description: 'Clothing, footwear, headgear', selected: false },
      { classNumber: 35, description: 'Advertising, business services', selected: false },
      { classNumber: 41, description: 'Education, entertainment', selected: false },
      { classNumber: 42, description: 'Scientific, technological services', selected: false },
      { classNumber: 45, description: 'Legal services', selected: false }
    ];
  }

  // Tab Navigation
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Patent Application Methods
  addClaim(): void {
    const newClaim: PatentClaim = {
      id: Date.now().toString(),
      claimNumber: this.patentClaims.length + 1,
      claimText: '',
      type: 'independent'
    };
    this.patentClaims.push(newClaim);
    this.savePatentClaims();
  }

  removeClaim(id: string): void {
    this.patentClaims = this.patentClaims.filter(c => c.id !== id);
    // Renumber claims
    this.patentClaims.forEach((claim, index) => {
      claim.claimNumber = index + 1;
    });
    this.savePatentClaims();
  }

  updateClaim(claim: PatentClaim): void {
    this.savePatentClaims();
  }

  private savePatentClaims(): void {
    localStorage.setItem('ip_patentClaims', JSON.stringify(this.patentClaims));
  }

  generatePatentApplication(): void {
    if (this.patentForm.invalid || this.patentClaims.length === 0) {
      this.markFormGroupTouched(this.patentForm);
      return;
    }

    this.isGeneratingPatent = true;
    const formData = { ...this.patentForm.value, claims: this.patentClaims };
    
    this.http.post<any>('${environment.apiUrl}/api/ai/intellectual-property/generate-patent-application', formData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.generatedApplication = response.application;
          } else {
            this.generatedApplication = 'Error generating patent application. Please try again.';
          }
          this.isGeneratingPatent = false;
        },
        error: (error) => {
          console.error('Error generating patent application:', error);
          this.generatedApplication = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingPatent = false;
        }
      });
  }

  private createPatentApplication(data: any): string {
    const claimsText = this.patentClaims
      .map(c => `${c.claimNumber}. ${c.claimText}`)
      .join('\n\n');
    
    return `
UNITED STATES PATENT APPLICATION

Title: ${data.title}

CROSS-REFERENCE TO RELATED APPLICATIONS
${data.relatedApplications || 'None'}

FIELD OF THE INVENTION
${data.fieldOfInvention}

BACKGROUND OF THE INVENTION
${data.backgroundOfInvention}

${data.priorArtReferences ? `DESCRIPTION OF RELATED ART
${data.priorArtReferences}` : ''}

SUMMARY OF THE INVENTION
${data.summaryOfInvention}

The present invention solves the problem of: ${data.problemSolved}

Advantages of the present invention include:
${data.advantages}

DETAILED DESCRIPTION OF THE INVENTION
${data.detailedDescription}

CLAIMS

What is claimed is:

${claimsText}

ABSTRACT
${data.abstract}

Inventor: ${data.primaryInventor}
Address: ${data.inventorAddress}
    `.trim();
  }

  // Trademark Search Methods
  searchTrademark(): void {
    if (this.trademarkForm.invalid) {
      this.markFormGroupTouched(this.trademarkForm);
      return;
    }

    this.isSearchingTrademark = true;
    const data = this.trademarkForm.value;
    
    this.http.post<any>('${environment.apiUrl}/api/ai/intellectual-property/search-trademark', data)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Parse AI search results
            this.trademarkResults = this.parseTrademarkResults(response.searchResults);
          } else {
            this.trademarkResults = [];
          }
          this.isSearchingTrademark = false;
        },
        error: (error) => {
          console.error('Error searching trademarks:', error);
          this.trademarkResults = [];
          this.isSearchingTrademark = false;
          this.cdr.detectChanges();
        }
      });
  }

  private parseTrademarkResults(searchResults: string): any[] {
    // Basic parsing of AI response to extract trademark matches
    const results = [];
    const lines = searchResults.split('\n');
    let currentResult: any = null;
    
    for (const line of lines) {
      if (line.includes('Registration') || line.includes('Mark:')) {
        if (currentResult) {
          results.push(currentResult);
        }
        currentResult = {
          registrationNumber: 'Pending',
          mark: line,
          owner: 'Unknown',
          status: 'Unknown',
          classes: [],
          filingDate: new Date(),
          similarity: 50,
          conflictLevel: 'medium'
        };
      }
    }
    
    if (currentResult) {
      results.push(currentResult);
    }
    
    return results.length > 0 ? results : this.generateTrademarkResults(this.trademarkForm.value.markText);
  }

  private generateTrademarkResults(searchTerm: string): any[] {
    // Simulate search results
    return [
      {
        registrationNumber: '5,123,456',
        mark: searchTerm.toUpperCase() + ' TECH',
        owner: 'Tech Corporation',
        status: 'Registered',
        classes: [9, 42],
        filingDate: new Date(2020, 5, 15),
        similarity: 75,
        conflictLevel: 'medium'
      },
      {
        registrationNumber: '4,987,654',
        mark: searchTerm + ' Solutions',
        owner: 'Solutions LLC',
        status: 'Pending',
        classes: [35],
        filingDate: new Date(2021, 8, 22),
        similarity: 60,
        conflictLevel: 'low'
      },
      {
        registrationNumber: '5,555,555',
        mark: searchTerm.split('').join('.') + '.',
        owner: 'Design Studio Inc.',
        status: 'Registered',
        classes: [25, 41],
        filingDate: new Date(2019, 2, 10),
        similarity: 40,
        conflictLevel: 'low'
      }
    ];
  }

  // Copyright Registration Methods
  generateCopyrightRegistration(): void {
    if (this.copyrightForm.invalid) {
      this.markFormGroupTouched(this.copyrightForm);
      return;
    }

    this.isGeneratingCopyright = true;
    const formData = this.copyrightForm.value;
    
    this.http.post<any>('${environment.apiUrl}/api/ai/intellectual-property/generate-copyright-registration', formData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.generatedCopyright = response.registration;
          } else {
            this.generatedCopyright = 'Error generating copyright registration. Please try again.';
          }
          this.isGeneratingCopyright = false;
        },
        error: (error) => {
          console.error('Error generating copyright registration:', error);
          this.generatedCopyright = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingCopyright = false;
        }
      });
  }

  private createCopyrightApplication(data: any): string {
    const workTypeLabel = this.workTypes.find(t => t.value === data.workType)?.label || 'Work';
    
    return `
FORM CO
APPLICATION FOR COPYRIGHT REGISTRATION

1. TITLE OF WORK: ${data.workTitle}

2. TYPE OF WORK: ${workTypeLabel}

3. YEAR OF CREATION: ${data.yearOfCreation}

4. PUBLICATION:
   Status: ${data.publicationStatus === 'published' ? 'Published' : 'Unpublished'}
   ${data.publicationStatus === 'published' ? `Date: ${data.publicationDate}
   Nation: ${data.publicationCountry}` : ''}

5. AUTHOR INFORMATION:
   Name: ${data.authorName}
   Type: ${data.authorType}
   Citizenship: ${data.authorCitizenship}
   Domicile: ${data.authorDomicile}
   Work for Hire: ${data.workForHire ? 'Yes' : 'No'}

6. CLAIMANT:
   Name: ${data.claimantName}
   Address: ${data.claimantAddress}
   ${data.transferStatement ? `Transfer: ${data.transferStatement}` : ''}

7. LIMITATION OF COPYRIGHT CLAIM:
   ${data.limitationOfClaim || 'N/A'}
   
   Material Excluded: ${data.materialExcluded || 'None'}
   Previous/Preexisting Material: ${data.preexistingMaterial || 'None'}
   New Material Included: ${data.newMaterialIncluded || 'Entire work'}

8. CERTIFICATION:
   I, the undersigned, hereby certify that I am the:
   ☑ Author
   ☑ Copyright claimant
   ☐ Owner of exclusive rights
   ☐ Authorized agent

   of the work identified in this application and that the statements made 
   by me in this application are correct to the best of my knowledge.

   Typed Name: ${data.claimantName}
   Date: ${new Date().toLocaleDateString()}

DEPOSIT REQUIREMENT:
Deposit accompanying this application consists of the best edition of the work.
    `.trim();
  }

  // Prior Art Search Methods
  searchPriorArt(): void {
    if (this.priorArtForm.invalid) {
      this.markFormGroupTouched(this.priorArtForm);
      return;
    }

    this.isSearchingPriorArt = true;
    const data = this.priorArtForm.value;
    
    this.http.post<any>('${environment.apiUrl}/api/ai/intellectual-property/search-prior-art', data)
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Parse AI prior art results
            this.priorArtResults = this.parsePriorArtResults(response.priorArtResults, data);
          } else {
            this.priorArtResults = [];
          }
          this.isSearchingPriorArt = false;
        },
        error: (error) => {
          console.error('Error searching prior art:', error);
          this.priorArtResults = [];
          this.isSearchingPriorArt = false;
        }
      });
  }

  private parsePriorArtResults(resultsText: string, searchData: any): PriorArtResult[] {
    // Basic parsing of AI response
    const results: PriorArtResult[] = [];
    const patents = resultsText.match(/US\d+[A-Z]?\d*/g) || [];
    
    patents.forEach((patent, index) => {
      results.push({
        id: String(index + 1),
        title: `Prior Art Reference ${index + 1}`,
        publicationNumber: patent,
        publicationDate: new Date(2020 - index, index, 1),
        relevance: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
        abstract: 'AI-identified prior art reference',
        similarity: Math.max(30, 90 - index * 10)
      });
    });
    
    return results.length > 0 ? results : this.generatePriorArtResults(searchData);
  }

  private generatePriorArtResults(searchData: any): PriorArtResult[] {
    // Simulate prior art search results
    return [
      {
        id: '1',
        title: 'Method and System for ' + searchData.inventionTitle,
        publicationNumber: 'US10,123,456B2',
        publicationDate: new Date(2019, 5, 15),
        relevance: 'high',
        abstract: 'A method and system related to the technical field...',
        similarity: 85
      },
      {
        id: '2',
        title: 'Apparatus for Enhanced ' + searchData.technicalField,
        publicationNumber: 'US9,876,543B1',
        publicationDate: new Date(2018, 2, 10),
        relevance: 'medium',
        abstract: 'An apparatus comprising novel features...',
        similarity: 65
      },
      {
        id: '3',
        title: 'Improved Process for ' + searchData.keywords.split(',')[0],
        publicationNumber: 'EP3123456A1',
        publicationDate: new Date(2017, 8, 22),
        relevance: 'low',
        abstract: 'An improved process that addresses similar problems...',
        similarity: 45
      }
    ];
  }

  // License Agreement Methods
  generateLicenseAgreement(): void {
    if (this.licenseForm.invalid) {
      this.markFormGroupTouched(this.licenseForm);
      return;
    }

    this.isGeneratingLicense = true;
    const formData = this.licenseForm.value;
    
    this.http.post<any>('${environment.apiUrl}/api/ai/intellectual-property/generate-license-agreement', formData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.generatedLicense = response.agreement;
          } else {
            this.generatedLicense = 'Error generating license agreement. Please try again.';
          }
          this.isGeneratingLicense = false;
        },
        error: (error) => {
          console.error('Error generating license agreement:', error);
          this.generatedLicense = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingLicense = false;
          this.cdr.detectChanges();
        }
      });
  }

  private createLicenseAgreement(data: any): string {
    const licenseTypeText = this.licenseTypes.find(t => t.value === data.licenseType)?.label || 'License';
    
    return `
${licenseTypeText.toUpperCase()} AGREEMENT

This Agreement is entered into as of ${data.duration.startDate} between:

LICENSOR: ${data.licensorName}
Address: ${data.licensorAddress}

LICENSEE: ${data.licenseeName}
Address: ${data.licenseeAddress}

RECITALS
WHEREAS, Licensor owns certain ${data.ipType} rights described herein;
WHEREAS, Licensee desires to obtain a license to use such rights;

NOW, THEREFORE, the parties agree as follows:

1. GRANT OF LICENSE
Licensor grants to Licensee ${data.licenseType === 'exclusive' ? 'an exclusive' : data.licenseType === 'non-exclusive' ? 'a non-exclusive' : 'a sole'} license to:
${data.ipDescription}

Registration/Patent Numbers: ${data.registrationNumbers || 'To be provided'}

2. TERRITORY
This license is granted for: ${data.territory}

3. FIELD OF USE
${data.fieldOfUse ? `Limited to: ${data.fieldOfUse}` : 'Unrestricted'}

4. TERM
Start Date: ${data.duration.startDate}
${data.duration.perpetual ? 'Duration: Perpetual' : `End Date: ${data.duration.endDate}`}

5. FINANCIAL TERMS
${data.upfrontPayment > 0 ? `Upfront Payment: $${data.upfrontPayment.toLocaleString()}` : ''}
${data.royaltyRate > 0 ? `Royalty Rate: ${data.royaltyRate}% of ${data.royaltyBase}` : ''}
${data.minimumRoyalties > 0 ? `Minimum Annual Royalties: $${data.minimumRoyalties.toLocaleString()}` : ''}
${data.milestonePayments ? `Milestone Payments: ${data.milestonePayments}` : ''}

6. SUBLICENSE RIGHTS
${data.sublicenseRights ? 'Licensee may grant sublicenses with Licensor\'s written consent.' : 'No sublicense rights granted.'}

7. IMPROVEMENTS
Rights to improvements: ${data.improvementRights === 'licensor' ? 'Owned by Licensor' : data.improvementRights === 'licensee' ? 'Owned by Licensee' : 'Jointly owned'}

8. QUALITY CONTROL
${data.qualityControl ? 'Licensee shall maintain quality standards approved by Licensor.' : 'No quality control provisions.'}

9. CONFIDENTIALITY
${data.confidentiality ? 'Both parties agree to maintain confidentiality of proprietary information.' : ''}

10. TERMINATION
Either party may terminate upon material breach with 30 days written notice.

11. GOVERNING LAW
This Agreement shall be governed by the laws of ${data.territory}.

LICENSOR: _______________________  Date: __________
          ${data.licensorName}

LICENSEE: _______________________  Date: __________
          ${data.licenseeName}
    `.trim();
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
  getConflictLevelClass(level: string): string {
    const classes: any = {
      'high': 'badge bg-danger',
      'medium': 'badge bg-warning',
      'low': 'badge bg-success'
    };
    return classes[level] || 'badge bg-secondary';
  }

  getRelevanceClass(relevance: string): string {
    const classes: any = {
      'high': 'text-danger',
      'medium': 'text-warning',
      'low': 'text-success'
    };
    return classes[relevance] || 'text-secondary';
  }

  getSimilarityColor(similarity: number): string {
    if (similarity >= 70) return 'danger';
    if (similarity >= 40) return 'warning';
    return 'success';
  }

  // Load Sample Data Methods
  loadSamplePatentApplication(): void {
    this.patentForm.patchValue({
      patentType: 'utility',
      title: 'Adaptive Machine Learning System for Real-Time Data Processing and Anomaly Detection',
      primaryInventor: 'Dr. Sarah Chen',
      inventorAddress: '123 Innovation Drive, Palo Alto, CA 94301',
      fieldOfInvention: 'This invention relates generally to machine learning systems and methods, and more particularly to adaptive machine learning systems capable of real-time data processing and anomaly detection in distributed computing environments.',
      backgroundOfInvention: 'Traditional machine learning systems face significant challenges when processing large volumes of streaming data in real-time while maintaining accuracy for anomaly detection. Existing solutions often struggle with concept drift, where the underlying data patterns change over time, leading to degraded performance. Current systems typically require manual intervention to retrain models, causing downtime and reduced efficiency.',
      summaryOfInvention: 'The present invention provides an adaptive machine learning system that automatically adjusts to changing data patterns while maintaining real-time processing capabilities. The system employs a novel ensemble approach combining multiple lightweight models with dynamic weighting algorithms to detect anomalies in streaming data without requiring manual retraining.',
      detailedDescription: 'The adaptive machine learning system comprises multiple components working in concert: a data ingestion module that handles high-velocity data streams, a model ensemble manager that maintains multiple specialized models, a dynamic weighting algorithm that adjusts model contributions based on performance metrics, and an anomaly detection engine that provides real-time alerts.',
      abstract: 'An adaptive machine learning system for real-time anomaly detection in streaming data environments, featuring dynamic model ensemble management and automatic adaptation to changing data patterns.',
      technicalField: 'Machine Learning and Artificial Intelligence',
      problemSolved: 'Automatic adaptation to concept drift in streaming data while maintaining real-time anomaly detection accuracy',
      advantages: 'Eliminates need for manual model retraining, maintains high accuracy during concept drift, provides sub-second response times, scales horizontally across distributed systems',
      priorArtReferences: 'US Patent 9,123,456 - Static ensemble methods for batch data processing; US Patent 8,987,654 - Traditional anomaly detection in time series data',
      relatedApplications: 'None'
    });

    // Add sample patent claims
    this.patentClaims = [
      {
        id: '1',
        claimNumber: 1,
        claimText: 'An adaptive machine learning system comprising: a data ingestion module configured to receive streaming data; a model ensemble manager maintaining a plurality of machine learning models; a dynamic weighting algorithm that adjusts contribution weights of said models based on real-time performance metrics; and an anomaly detection engine that processes said streaming data using said weighted model ensemble to identify anomalous patterns.',
        type: 'independent'
      },
      {
        id: '2',
        claimNumber: 2,
        claimText: 'The system of claim 1, wherein said dynamic weighting algorithm employs exponential decay functions to reduce weights of underperforming models.',
        type: 'dependent',
        dependsOn: 1
      },
      {
        id: '3',
        claimNumber: 3,
        claimText: 'The system of claim 1, further comprising a concept drift detection module that triggers model adaptation based on statistical significance tests.',
        type: 'dependent',
        dependsOn: 1
      }
    ];
    this.savePatentClaims();
  }

  loadSampleTrademarkSearch(): void {
    this.trademarkForm.patchValue({
      markText: 'TechFlow',
      markType: 'wordmark',
      goodsServices: 'Computer software for data analysis and visualization; cloud computing services; software as a service (SaaS) featuring business analytics tools; technical consulting services in the field of data management',
      ownerName: 'TechFlow Innovations LLC',
      ownerType: 'corporation',
      ownerAddress: '500 Technology Boulevard, Austin, TX 78701',
      firstUseDate: '2023-01-15',
      firstUseInCommerceDate: '2023-03-01',
      disclaimer: 'No claim is made to the exclusive right to use "TECH" apart from the mark as shown',
      translation: '',
      searchScope: 'federal'
    });

    // Mark relevant trademark classes as selected
    this.trademarkClasses.forEach(cls => {
      if (cls.classNumber === 9 || cls.classNumber === 42) {
        cls.selected = true;
      }
    });
  }

  loadSampleCopyrightRegistration(): void {
    this.copyrightForm.patchValue({
      workTitle: 'DataViz Pro: Advanced Analytics Dashboard Software',
      workType: 'software',
      yearOfCreation: 2024,
      publicationStatus: 'published',
      publicationDate: '2024-01-15',
      publicationCountry: 'United States',
      authorName: 'Jennifer Martinez',
      authorType: 'individual',
      authorCitizenship: 'United States',
      authorDomicile: 'United States',
      workForHire: false,
      claimantName: 'Jennifer Martinez',
      claimantAddress: '789 Software Lane, Seattle, WA 98101',
      transferStatement: '',
      limitationOfClaim: 'The claim is limited to the computer software code, user interface design, and documentation. Excludes any third-party libraries or open-source components.',
      preexistingMaterial: 'Standard software libraries and frameworks including React.js, D3.js, and Node.js',
      materialExcluded: 'Third-party open source libraries, stock images, and fonts',
      newMaterialIncluded: 'Original software code, custom algorithms, user interface design, proprietary data visualization components, and technical documentation'
    });
  }

  loadSamplePriorArtSearch(): void {
    this.priorArtForm.patchValue({
      inventionTitle: 'Quantum-Enhanced Cryptographic Key Distribution System',
      keywords: 'quantum cryptography, key distribution, quantum entanglement, secure communication, quantum key distribution, QKD, quantum mechanics, photon pairs',
      technicalField: 'Quantum Communications and Cryptography',
      inventionDescription: 'A novel quantum key distribution system that utilizes entangled photon pairs for secure cryptographic key exchange between remote parties. The system employs quantum mechanical properties to detect eavesdropping attempts and ensure unconditional security. The invention includes hardware components for photon generation, transmission, detection, and software protocols for key distillation and authentication.',
      searchDatabases: {
        uspto: true,
        googlePatents: true,
        espacenet: true,
        wipo: true,
        nonPatentLiterature: true
      },
      dateRange: {
        startDate: '2010-01-01',
        endDate: '2024-05-20'
      },
      jurisdictions: 'US,EP,CN,JP'
    });
  }

  loadSampleLicenseAgreement(): void {
    this.licenseForm.patchValue({
      licenseType: 'non-exclusive',
      licensorName: 'Quantum Innovations Research Institute',
      licensorAddress: '100 Research Park Drive, Boston, MA 02138',
      licenseeName: 'SecureComm Technologies Inc.',
      licenseeAddress: '500 Enterprise Way, San Jose, CA 95110',
      ipType: 'patent',
      ipDescription: 'Patented technology related to quantum key distribution methods and apparatus, including systems for generating, transmitting, and detecting quantum-entangled photons for secure communication networks. Covers quantum cryptographic protocols and hardware implementations.',
      registrationNumbers: 'US Patent 11,234,567; US Patent 11,345,678; US Patent Application 17/456,789',
      territory: 'United States and Canada',
      fieldOfUse: 'Commercial telecommunications and secure communication systems for financial institutions and government agencies',
      duration: {
        startDate: '2024-06-01',
        endDate: '2029-05-31',
        perpetual: false
      },
      royaltyRate: 3.5,
      royaltyBase: 'net-sales',
      upfrontPayment: 250000,
      minimumRoyalties: 100000,
      milestonePayments: 'Development milestone: $50,000 upon first commercial implementation; Sales milestone: $100,000 upon reaching $10M in cumulative sales',
      sublicenseRights: true,
      improvementRights: 'joint',
      qualityControl: true,
      confidentiality: true,
      nonCompete: false
    });
  }
}