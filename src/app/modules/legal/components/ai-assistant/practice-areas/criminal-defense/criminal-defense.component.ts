import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { PracticeAreaBaseComponent } from '../../shared/practice-area-base.component';
import { AiResponseFormatterPipe } from '../../shared/ai-response-formatter.pipe';
import { AiResponseModalService } from '../../shared/services/ai-response-modal.service';

interface SentencingGuideline {
  offense: string;
  level: number;
  baseRange: string;
  enhancements: string[];
  mitigations: string[];
}

interface MotionTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
}

@Component({
  selector: 'app-criminal-defense',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, HttpClientModule, AiResponseFormatterPipe],
  templateUrl: './criminal-defense.component.html',
  styleUrls: ['./criminal-defense.component.scss']
})
export class CriminalDefenseComponent extends PracticeAreaBaseComponent implements OnInit {
  activeTab: string = 'motion-drafting';
  
  // Motion Drafting
  motionForm: FormGroup;
  motionTemplates: MotionTemplate[] = [
    { id: '1', name: 'Motion to Suppress Evidence', type: 'Pre-Trial', description: 'Challenge illegally obtained evidence' },
    { id: '2', name: 'Motion to Dismiss', type: 'Pre-Trial', description: 'Request dismissal of charges' },
    { id: '3', name: 'Motion for Discovery', type: 'Pre-Trial', description: 'Request prosecution evidence' },
    { id: '4', name: 'Motion in Limine', type: 'Pre-Trial', description: 'Exclude prejudicial evidence' },
    { id: '5', name: 'Motion for Bail Reduction', type: 'Pre-Trial', description: 'Request lower bail amount' },
    { id: '6', name: 'Motion for New Trial', type: 'Post-Trial', description: 'Request new trial based on errors' }
  ];
  selectedMotionTemplate: MotionTemplate | null = null;
  generatedMotion: string = '';
  isGeneratingMotion: boolean = false;

  // Sentencing Calculator
  sentencingForm: FormGroup;
  calculatedSentence: any = null;
  offenseCategories = [
    { value: 'drug', label: 'Drug Offenses' },
    { value: 'violent', label: 'Violent Crimes' },
    { value: 'property', label: 'Property Crimes' },
    { value: 'white-collar', label: 'White Collar Crimes' },
    { value: 'sex', label: 'Sex Offenses' }
  ];
  
  // Case Analysis
  caseAnalysisForm: FormGroup;
  analysisResult: any = null;
  isAnalyzing: boolean = false;
  charges: string[] = [];
  newCharge: string = '';

  // Evidence Tracker
  evidenceItems: any[] = [];
  newEvidence = {
    type: '',
    description: '',
    source: '',
    admissibility: 'pending',
    importance: 'medium'
  };

  // Plea Agreement Analyzer
  pleaForm: FormGroup;
  pleaAnalysis: any = null;
  
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private aiModalService: AiResponseModalService
  ) {
    super();
    // Initialize Motion Form - Simplified validation
    this.motionForm = this.fb.group({
      motionType: ['', Validators.required],
      caseNumber: ['', Validators.required],
      defendantName: ['', Validators.required],
      countyName: ['', Validators.required],
      factualBasis: ['', [Validators.required, Validators.minLength(20)]], // Reduced from 50 to 20
      legalArguments: ['', Validators.required], // Removed minLength requirement
      requestedRelief: ['', Validators.required]
    });

    // Initialize Sentencing Form
    this.sentencingForm = this.fb.group({
      offenseCategory: ['', Validators.required],
      offenseLevel: [1, [Validators.required, Validators.min(1), Validators.max(43)]],
      criminalHistory: [0, [Validators.required, Validators.min(0), Validators.max(6)]],
      priorConvictions: [0, [Validators.required, Validators.min(0)]],
      enhancements: this.fb.group({
        firearmUsed: [false],
        drugQuantity: [false],
        victimVulnerable: [false],
        leadershipRole: [false],
        obstructionJustice: [false]
      }),
      mitigations: this.fb.group({
        acceptResponsibility: [false],
        minorRole: [false],
        cooperation: [false],
        noViolence: [false]
      })
    });

    // Initialize Case Analysis Form
    this.caseAnalysisForm = this.fb.group({
      facts: ['', [Validators.required, Validators.minLength(200)]],
      priorRecord: [''],
      witnessInfo: [''],
      evidenceSummary: ['']
    });

    // Initialize Plea Form
    this.pleaForm = this.fb.group({
      originalCharges: ['', Validators.required],
      offeredPlea: ['', Validators.required],
      sentenceRange: ['', Validators.required],
      probationTerms: [''],
      fines: [''],
      specialConditions: ['']
    });
  }

  ngOnInit(): void {
    this.loadSavedData();
  }

  loadSavedData(): void {
    // Load any saved evidence items from localStorage
    const savedEvidence = localStorage.getItem('criminalDefense_evidence');
    if (savedEvidence) {
      this.evidenceItems = JSON.parse(savedEvidence);
    }
  }

  // Tab Navigation
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Motion Drafting Methods
  selectMotionTemplate(template: MotionTemplate): void {
    this.selectedMotionTemplate = template;
    this.motionForm.patchValue({
      motionType: template.name
    });
  }

  generateMotion(): void {
    console.log('Generate Motion clicked');
    console.log('Form valid:', this.motionForm.valid);
    console.log('Form values:', this.motionForm.value);
    
    if (this.motionForm.invalid) {
      console.log('Form is invalid, marking as touched');
      this.markFormGroupTouched(this.motionForm);
      console.log('Form errors:', this.motionForm.errors);
      Object.keys(this.motionForm.controls).forEach(key => {
        const control = this.motionForm.get(key);
        if (control && control.errors) {
          console.log(`Field ${key} errors:`, control.errors);
        }
      });
      return;
    }

    console.log('Sending request to backend...');
    this.isGeneratingMotion = true;
    const formData = this.motionForm.value;
    
    // Call backend API
    this.http.post<any>('http://localhost:8085/api/ai/criminal-defense/generate-motion', formData)
      .subscribe({
        next: (response) => {
          if (response.success && response.content) {
            this.generatedMotion = response.content;

            // Open modal with generated motion
            const contextInfo = {
              'Motion Type': this.selectedMotionTemplate?.name || formData.motionType,
              'Case Number': formData.caseNumber,
              'Defendant': formData.defendantName,
              'County': formData.countyName
            };
            this.aiModalService.openMotionDraft(response.content, contextInfo);
          } else {
            this.generatedMotion = 'Error generating motion. Please try again.';
          }
          this.isGeneratingMotion = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error generating motion:', error);
          this.generatedMotion = 'Error connecting to AI service. Please try again later.';
          this.isGeneratingMotion = false;
          this.cdr.detectChanges();
        }
      });
  }

  private createMotionContent(data: any): string {
    return `
IN THE ${data.countyName}

Case No. ${data.caseNumber}

STATE/COMMONWEALTH
v.
${data.defendantName}
Defendant

${data.motionType.toUpperCase()}

NOW COMES the Defendant, ${data.defendantName}, by and through undersigned counsel, and respectfully moves this Honorable Court for the following relief:

FACTUAL BASIS

${data.factualBasis}

LEGAL ARGUMENTS

${data.legalArguments}

REQUESTED RELIEF

${data.requestedRelief}

WHEREFORE, Defendant respectfully requests that this Honorable Court grant this motion and provide such other and further relief as the Court deems just and proper.

Respectfully submitted,

_______________________
Attorney for Defendant
[Bar Number]
[Contact Information]
    `.trim();
  }

  // Sentencing Calculator Methods
  calculateSentence(): void {
    if (this.sentencingForm.invalid) {
      this.markFormGroupTouched(this.sentencingForm);
      return;
    }

    // Call backend API
    this.http.post<any>('http://localhost:8085/api/ai/criminal-defense/calculate-sentence', this.sentencingForm.value)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.calculatedSentence = response;

            // Open modal with sentencing calculation
            if (response.analysis || response.recommendation) {
              const formData = this.sentencingForm.value;
              const contextInfo = {
                'Offense': formData.offenseCategory,
                'Offense Level': formData.offenseLevel,
                'Criminal History': formData.criminalHistory,
                'Defendant': formData.defendantName
              };
              this.aiModalService.openSentencingCalculation(
                response.analysis || response.recommendation || 'Sentencing calculation complete',
                contextInfo
              );
            }
          } else {
            console.error('Calculation failed:', response.error);
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error calculating sentence:', error);
          this.cdr.detectChanges();
        }
      });
  }

  private getSentencingRange(level: number, history: number): { min: number, max: number } {
    // Simplified sentencing table (actual would be much more complex)
    const baseMin = level * 2 + history * 3;
    const baseMax = level * 3 + history * 4;
    
    return {
      min: Math.max(0, baseMin),
      max: baseMax
    };
  }

  private getCriminalHistoryCategory(points: number): string {
    if (points === 0) return 'I (0 points)';
    if (points <= 2) return 'II (1-2 points)';
    if (points <= 4) return 'III (3-4 points)';
    if (points <= 6) return 'IV (5-6 points)';
    if (points <= 9) return 'V (7-9 points)';
    return 'VI (10+ points)';
  }

  private getMandatoryMinimum(category: string): string {
    const minimums: any = {
      'drug': '5 years for certain quantities',
      'violent': '10 years for armed offenses',
      'sex': '5-15 years depending on victim age',
      'property': 'None',
      'white-collar': 'None'
    };
    return minimums[category] || 'None';
  }

  // Case Analysis Methods
  analyzeCase(): void {
    if (this.caseAnalysisForm.invalid || this.charges.length === 0) {
      this.markFormGroupTouched(this.caseAnalysisForm);
      this.updateChargesValidation();
      return;
    }

    this.isAnalyzing = true;
    
    // Call backend API
    const requestData = {
      ...this.caseAnalysisForm.value,
      charges: this.charges.join('; ')
    };
    this.http.post<any>('http://localhost:8085/api/ai/criminal-defense/analyze-case', requestData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.analysisResult = response;

            // Always open modal with case analysis
            const formData = this.caseAnalysisForm.value;
            const contextInfo = {
              'Charges': this.charges.join('; '),
              'Prior Record': formData.priorRecord || 'No prior record provided',
              'Witnesses': formData.witnessInfo || 'No witness information provided',
              'Evidence': formData.evidenceSummary || 'No evidence summary provided'
            };

            // Extract the proper analysis content
            let analysisContent = '';
            if (response.fullAnalysis) {
              analysisContent = response.fullAnalysis;
            } else if (response.analysis) {
              analysisContent = response.analysis;
            } else if (response.recommendation) {
              analysisContent = response.recommendation;
            } else {
              // Fallback: try to construct from response parts
              analysisContent = 'Case Analysis Results:\n\n';
              if (response.strengths && Array.isArray(response.strengths)) {
                analysisContent += 'Strengths:\n' + response.strengths.map(s => '• ' + s).join('\n') + '\n\n';
              }
              if (response.weaknesses && Array.isArray(response.weaknesses)) {
                analysisContent += 'Weaknesses:\n' + response.weaknesses.map(w => '• ' + w).join('\n') + '\n\n';
              }
              if (response.recommendations && Array.isArray(response.recommendations)) {
                analysisContent += 'Recommendations:\n' + response.recommendations.map(r => '• ' + r).join('\n');
              }
            }

            this.aiModalService.openCaseAnalysis(analysisContent, contextInfo);
          } else {
            console.error('Analysis failed:', response.error);
          }
          this.isAnalyzing = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error analyzing case:', error);
          this.isAnalyzing = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Evidence Tracker Methods
  addEvidence(): void {
    if (!this.newEvidence.type || !this.newEvidence.description) {
      return;
    }

    this.evidenceItems.push({
      ...this.newEvidence,
      id: Date.now().toString(),
      dateAdded: new Date()
    });

    // Save to localStorage
    localStorage.setItem('criminalDefense_evidence', JSON.stringify(this.evidenceItems));

    // Reset form
    this.newEvidence = {
      type: '',
      description: '',
      source: '',
      admissibility: 'pending',
      importance: 'medium'
    };
  }

  removeEvidence(id: string): void {
    this.evidenceItems = this.evidenceItems.filter(item => item.id !== id);
    localStorage.setItem('criminalDefense_evidence', JSON.stringify(this.evidenceItems));
  }

  // Plea Agreement Analyzer
  analyzePlea(): void {
    if (this.pleaForm.invalid) {
      this.markFormGroupTouched(this.pleaForm);
      return;
    }
    
    // Call backend API
    this.http.post<any>('http://localhost:8085/api/ai/criminal-defense/analyze-plea', this.pleaForm.value)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.pleaAnalysis = response;

            // Open modal with plea analysis
            if (response.analysis || response.recommendation) {
              const formData = this.pleaForm.value;
              const contextInfo = {
                'Original Charges': formData.originalCharges,
                'Offered Plea': formData.offeredPlea,
                'Sentence Range': formData.sentenceRange,
                'Probation Terms': formData.probationTerms || 'N/A'
              };
              this.aiModalService.openPleaAgreement(
                response.analysis || response.recommendation || 'Plea analysis complete',
                contextInfo
              );
            }
          } else {
            console.error('Analysis failed:', response.error);
          this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Error analyzing plea:', error);
          this.cdr.detectChanges();
        }
      });
  }


  getImportanceClass(importance: string): string {
    const classes: any = {
      'high': 'badge bg-danger',
      'medium': 'badge bg-warning',
      'low': 'badge bg-info'
    };
    return classes[importance] || 'badge bg-secondary';
  }

  getAdmissibilityClass(admissibility: string): string {
    const classes: any = {
      'admissible': 'text-success',
      'inadmissible': 'text-danger',
      'pending': 'text-warning'
    };
    return classes[admissibility] || 'text-secondary';
  }

  // Charges Management Methods
  addCharge(): void {
    console.log('addCharge called, newCharge:', this.newCharge);
    if (this.newCharge.trim()) {
      const countNumber = this.charges.length + 1;
      const formattedCharge = `Count ${countNumber}: ${this.newCharge.trim()}`;
      this.charges.push(formattedCharge);
      this.newCharge = '';
      this.updateChargesValidation();
      this.cdr.detectChanges();
    }
  }

  removeCharge(index: number): void {
    this.charges.splice(index, 1);
    // Renumber remaining charges
    this.charges = this.charges.map((charge, i) => {
      // Extract the charge text after the colon
      const chargeText = charge.replace(/^Count \d+:\s*/, '');
      return `Count ${i + 1}: ${chargeText}`;
    });
    this.updateChargesValidation();
    this.cdr.detectChanges();
  }

  isAddChargeDisabled(): boolean {
    return !this.newCharge || !this.newCharge.trim();
  }

  private updateChargesValidation(): void {
    // Custom validation for charges array
    if (this.charges.length === 0) {
      this.caseAnalysisForm.setErrors({ ...this.caseAnalysisForm.errors, noCharges: true });
    } else {
      if (this.caseAnalysisForm.errors) {
        delete this.caseAnalysisForm.errors['noCharges'];
        if (Object.keys(this.caseAnalysisForm.errors).length === 0) {
          this.caseAnalysisForm.setErrors(null);
        }
      }
    }
  }

  // Load Sample Data Methods
  loadSampleMotionDrafting(): void {
    const sampleTemplate = this.motionTemplates.find(t => t.id === '1'); // Motion to Suppress Evidence
    if (sampleTemplate) {
      this.selectMotionTemplate(sampleTemplate);
    }

    this.motionForm.patchValue({
      motionType: 'Motion to Suppress Evidence',
      caseNumber: 'CR-2024-00123',
      defendantName: 'John Michael Smith',
      countyName: 'Worcester County',
      factualBasis: 'On January 15, 2024, defendant was stopped by Officer Johnson for allegedly running a red light. During the traffic stop, Officer Johnson conducted a search of the vehicle without consent, a warrant, or probable cause. The search yielded evidence that the prosecution now seeks to use against defendant. The stop itself was pretextual, as video evidence shows the light was yellow when defendant entered the intersection.',
      legalArguments: 'The Fourth Amendment to the United States Constitution and Article 14 of the Massachusetts Declaration of Rights protect against unreasonable searches and seizures. Under Terry v. Ohio and Commonwealth v. Gonsalves, police officers may only conduct searches incident to arrest with proper justification. Here, no exigent circumstances existed, no consent was given, and no warrant was obtained. The exclusionary rule mandates suppression of illegally obtained evidence.',
      requestedRelief: 'Defendant respectfully requests that this Honorable Court suppress all evidence obtained during the unlawful search of January 15, 2024, including any statements made by defendant following the illegal search, and any derivative evidence obtained as a result thereof.'
    });
  }

  loadSampleSentencingCalculator(): void {
    this.sentencingForm.patchValue({
      offenseCategory: 'drug',
      offenseLevel: 24,
      criminalHistory: 3,
      priorConvictions: 2,
      enhancements: {
        firearmUsed: false,
        drugQuantity: true,
        victimVulnerable: false,
        leadershipRole: true,
        obstructionJustice: false
      },
      mitigations: {
        acceptResponsibility: true,
        minorRole: false,
        cooperation: true,
        noViolence: true
      }
    });
  }

  loadSampleCaseAnalysis(): void {
    // Clear the new charge input
    this.newCharge = '';

    // Load sample charges
    this.charges = [
      'Count 1: Possession with Intent to Distribute Cocaine (21 U.S.C. § 841(a)(1))',
      'Count 2: Conspiracy to Distribute Controlled Substances (21 U.S.C. § 846)',
      'Count 3: Money Laundering (18 U.S.C. § 1956)'
    ];
    this.updateChargesValidation();

    this.caseAnalysisForm.patchValue({
      facts: 'On March 10, 2024, defendant was arrested following a six-month DEA investigation into a drug trafficking organization. Surveillance revealed defendant meeting with known drug dealers on multiple occasions. A confidential informant made three controlled purchases of cocaine from defendant, totaling 500 grams. Search of defendant\'s residence pursuant to warrant revealed $45,000 in cash, digital scales, packaging materials, and 2 kilograms of cocaine. Cell phone records show communications with other members of the conspiracy using coded language. Bank records indicate deposits inconsistent with defendant\'s reported income as a retail manager.',
      priorRecord: 'Defendant has two prior felony convictions: 2018 conviction for possession of controlled substance (sentenced to 18 months probation), and 2020 conviction for distribution of marijuana (sentenced to 6 months imprisonment). No history of violent offenses.',
      witnessInfo: 'Government witnesses include: (1) DEA Agent Martinez - case agent who supervised investigation; (2) CI-1 - confidential informant who made controlled purchases; (3) Detective Lopez - executed search warrant; (4) Bank investigator Johnson - will testify regarding financial records. Defense witnesses may include character witnesses and employment supervisor.',
      evidenceSummary: 'Physical evidence: 2 kg cocaine, digital scales, $45,000 cash, packaging materials. Documentary evidence: bank records, cell phone records, surveillance photos. Audio/video: recorded controlled purchases, surveillance footage. Digital evidence: text messages, call logs. Chain of custody appears proper for all physical evidence.'
    });

    this.cdr.detectChanges();
  }

  loadSamplePleaAgreement(): void {
    this.pleaForm.patchValue({
      originalCharges: 'Count 1: Armed Robbery (M.G.L. c. 265, § 17); Count 2: Assault and Battery with Dangerous Weapon (M.G.L. c. 265, § 15A); Count 3: Unlawful Possession of Firearm (M.G.L. c. 269, § 10)',
      offeredPlea: 'Guilty to Count 1: Unarmed Robbery (M.G.L. c. 265, § 19); Counts 2 and 3 to be dismissed',
      sentenceRange: '3-5 years state prison, with possibility of suspended sentence after 18 months served',
      probationTerms: '3 years supervised probation, weekly reporting, community service 200 hours, restitution $2,500 to victim, no contact with victim',
      fines: 'Restitution: $2,500; Court costs: $150; Victim witness fee: $50; No additional fines',
      specialConditions: 'Defendant must complete anger management counseling, substance abuse evaluation and treatment if recommended, maintain steady employment or full-time education, submit to random drug testing, comply with 9pm-6am curfew for first 6 months of probation, perform 200 hours community service within 18 months'
    });
  }
}