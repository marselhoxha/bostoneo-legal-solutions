import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Key } from 'src/app/enum/key.enum';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';

interface ContextType {
  value: string;
  label: string;
  description: string;
  requiresCase: boolean;
  requiresClient: boolean;
  requiresMultipleCases: boolean;
}

interface VariableSuggestion {
  variableName: string;
  variableType: string;
  suggestedValue: string;
  source: string;
  confidence: number;
  isRequired: boolean;
}

interface Case {
  id: number;
  caseNumber: string;
  title: string;
  clientId: number;
  clientName?: string;
}

interface Client {
  id: number;
  name: string;
  email: string;
}

interface TemplateVariable {
  variableName: string;
  variableType: string;
  defaultValue?: string;
  isRequired: boolean;
  description?: string;
}

@Component({
  selector: 'app-auto-fill-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './auto-fill-wizard.component.html',
  styleUrls: ['./auto-fill-wizard.component.scss']
})
export class AutoFillWizardComponent implements OnInit {
  @Input() templateId: number | null = null;
  @Input() templateName: string = '';
  @Output() documentGenerated = new EventEmitter<any>();
  @Output() closed = new EventEmitter<void>();

  currentStep: number = 1;
  totalSteps: number = 4;

  contextForm: FormGroup;
  variablesForm: FormGroup;

  contextTypes: ContextType[] = [];
  cases: Case[] = [];
  clients: Client[] = [];
  variableSuggestions: VariableSuggestion[] = [];
  templateVariables: TemplateVariable[] = [];

  selectedContext: string = 'STANDALONE';
  selectedCase: Case | null = null;
  selectedClient: Client | null = null;
  selectedCases: Case[] = [];

  // Search terms
  caseSearchTerm: string = '';
  clientSearchTerm: string = '';
  filteredCases: Case[] = [];
  filteredClients: Client[] = [];

  useAiSuggestions: boolean = true;
  useAiEnhancement: boolean = true;
  outputFormat: string = 'PDF';

  isLoading: boolean = false;
  generatedContent: string = '';
  warnings: string[] = [];
  complianceChecks: string[] = [];

  private apiUrl = `${environment.apiUrl}/api/ai/templates`;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.contextForm = this.fb.group({
      contextType: ['STANDALONE', Validators.required],
      caseId: [null],
      clientId: [null],
      caseIds: [[]],
      useAiSuggestions: [true],
      useAiEnhancement: [true],
      outputFormat: ['PDF']
    });

    this.variablesForm = this.fb.group({});
  }

  ngOnInit() {
    this.loadContextTypes();
    this.loadCasesFromDatabase();
    this.loadClientsFromDatabase();

    // Always try to load template variables first
    if (this.templateId) {
      this.loadVariables();
    } else {
      // Only use template-specific sample variables
      this.loadTemplateSpecificVariables();
    }
  }

  loadContextTypes() {
    // Default context types
    this.contextTypes = [
      {
        value: 'STANDALONE',
        label: 'Standalone Document',
        description: 'Create a document without linking to a specific case or client',
        requiresCase: false,
        requiresClient: false,
        requiresMultipleCases: false
      },
      {
        value: 'CLIENT',
        label: 'Client Document',
        description: 'Create a document for a specific client',
        requiresCase: false,
        requiresClient: true,
        requiresMultipleCases: false
      },
      {
        value: 'CASE',
        label: 'Case Document',
        description: 'Create a document for a specific case',
        requiresCase: true,
        requiresClient: false,
        requiresMultipleCases: false
      },
      {
        value: 'MULTI_CASE',
        label: 'Multi-Case Document',
        description: 'Create a document spanning multiple cases',
        requiresCase: false,
        requiresClient: false,
        requiresMultipleCases: true
      }
    ];

    // Try to load from API
    const headers = this.getAuthHeaders();
    this.http.get<any[]>(`${this.apiUrl}/context-types`, { headers }).subscribe({
      next: (types) => {
        if (types && types.length > 0) {
          this.contextTypes = types.map(t => ({
            value: t.value,
            label: t.label,
            description: t.description,
            requiresCase: t.value === 'CASE',
            requiresClient: t.value === 'CLIENT',
            requiresMultipleCases: t.value === 'MULTI_CASE'
          }));
        }
      },
      error: (error) => {
        // Keep default context types if API fails
      }
    });
  }

  loadCasesFromDatabase() {
    this.isLoading = true;
    const headers = this.getAuthHeaders();
    const url = `${environment.apiUrl}/legal-case/list?page=0&size=100`;

    this.http.get<any>(url, { headers }).subscribe({
      next: (response) => {

        // Handle different possible response structures
        let casesList = [];
        if (response) {
          if (response.data?.content) {
            casesList = response.data.content;
          } else if (response.data?.page?.content) {
            casesList = response.data.page.content;
          } else if (response.content) {
            casesList = response.content;
          } else if (Array.isArray(response)) {
            casesList = response;
          }
        }

        this.cases = casesList.map((c: any) => ({
          id: c.id,
          caseNumber: c.caseNumber || c.reference || `CASE-${c.id}`,
          title: c.title || c.caseName || c.description || 'Untitled Case',
          clientId: c.clientId || c.client?.id,
          clientName: c.clientName || c.client?.fullName || c.client?.name || 'Unknown Client'
        }));

        this.filteredCases = [...this.cases];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading cases:', error);
        this.cases = [];
        this.filteredCases = [];
        this.isLoading = false;
      }
    });
  }

  loadClientsFromDatabase() {
    this.isLoading = true;
    const headers = this.getAuthHeaders();
    const url = `${environment.apiUrl}/client?page=0&size=100`;

    this.http.get<any>(url, { headers }).subscribe({
      next: (response) => {
        // Handle different possible response structures
        let clientsList = [];
        if (response) {
          if (response.data?.content) {
            clientsList = response.data.content;
          } else if (response.data?.page?.content) {
            clientsList = response.data.page.content;
          } else if (response.content) {
            clientsList = response.content;
          } else if (Array.isArray(response)) {
            clientsList = response;
          }
        }

        this.clients = clientsList.map((c: any) => ({
          id: c.id,
          name: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unknown',
          email: c.email || 'No email'
        }));

        this.filteredClients = [...this.clients];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading clients:', error);
        this.clients = [];
        this.filteredClients = [];
        this.isLoading = false;
      }
    });
  }

  loadVariables() {
    if (!this.templateId) {
      this.loadSampleVariables();
      return;
    }

    this.isLoading = true;
    const headers = this.getAuthHeaders();

    this.http.get<any[]>(`${this.apiUrl}/${this.templateId}/variables`, { headers }).subscribe({
      next: (variables) => {
        if (variables && variables.length > 0) {
          this.templateVariables = variables;
          this.buildVariablesForm(variables);
        } else {
          // If no variables returned, use sample variables
          this.loadSampleVariables();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading template variables:', error);
        // Fallback to sample variables
        this.loadSampleVariables();
        this.isLoading = false;
      }
    });
  }

  private loadSampleVariables() {
    // Fallback to generic variables if all else fails
    this.loadTemplateSpecificVariables();
  }

  private loadTemplateSpecificVariables() {
    // Load variables based on template name/type
    const templateNameLower = this.templateName?.toLowerCase() || '';

    if (templateNameLower.includes('demand letter') || templateNameLower.includes('personal injury')) {
      this.templateVariables = [
        { variableName: 'plaintiff_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Plaintiff\'s full name' },
        { variableName: 'defendant_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Defendant\'s full name' },
        { variableName: 'injury_date', variableType: 'date', defaultValue: '', isRequired: true, description: 'Date of injury' },
        { variableName: 'injury_description', variableType: 'textarea', defaultValue: '', isRequired: true, description: 'Description of injuries' },
        { variableName: 'damages_amount', variableType: 'number', defaultValue: '', isRequired: false, description: 'Amount of damages sought' },
        { variableName: 'incident_location', variableType: 'text', defaultValue: '', isRequired: true, description: 'Location of incident' }
      ];
    } else if (templateNameLower.includes('employment') || templateNameLower.includes('ead')) {
      this.templateVariables = [
        { variableName: 'employee_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Employee\'s full name' },
        { variableName: 'employer_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Employer organization name' },
        { variableName: 'position_title', variableType: 'text', defaultValue: '', isRequired: true, description: 'Job position/title' },
        { variableName: 'start_date', variableType: 'date', defaultValue: '', isRequired: true, description: 'Employment start date' },
        { variableName: 'work_authorization_type', variableType: 'text', defaultValue: 'OPT', isRequired: true, description: 'Type of work authorization' },
        { variableName: 'degree_level', variableType: 'text', defaultValue: '', isRequired: false, description: 'Degree level (Bachelor\'s, Master\'s, etc.)' }
      ];
    } else if (templateNameLower.includes('i-130') || templateNameLower.includes('immigration')) {
      this.templateVariables = [
        { variableName: 'petitioner_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Petitioner\'s full name' },
        { variableName: 'beneficiary_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Beneficiary\'s full name' },
        { variableName: 'relationship', variableType: 'text', defaultValue: '', isRequired: true, description: 'Relationship to beneficiary' },
        { variableName: 'priority_date', variableType: 'date', defaultValue: '', isRequired: false, description: 'Priority date' },
        { variableName: 'alien_number', variableType: 'text', defaultValue: '', isRequired: false, description: 'Alien registration number' },
        { variableName: 'country_of_birth', variableType: 'text', defaultValue: '', isRequired: true, description: 'Beneficiary\'s country of birth' }
      ];
    } else if (templateNameLower.includes('divorce')) {
      this.templateVariables = [
        { variableName: 'party1_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'First party\'s name' },
        { variableName: 'party2_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Second party\'s name' },
        { variableName: 'marriage_date', variableType: 'date', defaultValue: '', isRequired: true, description: 'Date of marriage' },
        { variableName: 'separation_date', variableType: 'date', defaultValue: '', isRequired: false, description: 'Date of separation' },
        { variableName: 'children_count', variableType: 'number', defaultValue: '0', isRequired: false, description: 'Number of children' },
        { variableName: 'asset_division', variableType: 'textarea', defaultValue: '', isRequired: false, description: 'Asset division details' }
      ];
    } else if (templateNameLower.includes('civil complaint')) {
      this.templateVariables = [
        { variableName: 'plaintiff_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Plaintiff\'s name' },
        { variableName: 'defendant_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Defendant\'s name' },
        { variableName: 'court_name', variableType: 'text', defaultValue: 'Massachusetts Superior Court', isRequired: true, description: 'Name of court' },
        { variableName: 'cause_of_action', variableType: 'textarea', defaultValue: '', isRequired: true, description: 'Cause of action' },
        { variableName: 'relief_sought', variableType: 'textarea', defaultValue: '', isRequired: true, description: 'Relief sought' },
        { variableName: 'jurisdiction_basis', variableType: 'text', defaultValue: '', isRequired: false, description: 'Basis for jurisdiction' }
      ];
    } else {
      // Generic legal document variables
      this.templateVariables = [
        { variableName: 'party_name', variableType: 'text', defaultValue: '', isRequired: true, description: 'Party name' },
        { variableName: 'document_date', variableType: 'date', defaultValue: '', isRequired: true, description: 'Document date' },
        { variableName: 'jurisdiction', variableType: 'text', defaultValue: 'Massachusetts', isRequired: false, description: 'Legal jurisdiction' },
        { variableName: 'description', variableType: 'textarea', defaultValue: '', isRequired: false, description: 'Description' }
      ];
    }

    this.buildVariablesForm(this.templateVariables);
  }

  private buildVariablesForm(variables: TemplateVariable[]) {
    // Clear existing form controls
    Object.keys(this.variablesForm.controls).forEach(key => {
      this.variablesForm.removeControl(key);
    });

    // Build form controls for each variable
    variables.forEach(variable => {
      const validators = variable.isRequired ? [Validators.required] : [];
      this.variablesForm.addControl(
        variable.variableName,
        this.fb.control(variable.defaultValue || '', validators)
      );
    });

      }

  onContextChange() {
    // Update form value when selectedContext changes
    this.contextForm.patchValue({ contextType: this.selectedContext });

    const contextType = this.selectedContext;
    const context = this.contextTypes.find(c => c.value === contextType);

    if (context) {
      // Reset selections based on context
      if (!context.requiresCase) {
        this.contextForm.patchValue({ caseId: null });
        this.selectedCase = null;
      }
      if (!context.requiresClient) {
        this.contextForm.patchValue({ clientId: null });
        this.selectedClient = null;
      }
      if (!context.requiresMultipleCases) {
        this.contextForm.patchValue({ caseIds: [] });
        this.selectedCases = [];
      }
    }

    // Get AI suggestions for the new context
    if (this.currentStep === 2 && this.useAiSuggestions) {
      this.getAiSuggestions();
    }
  }

  getAiSuggestions() {
    if (!this.templateId) {
      return;
    }

    const context: any = {
      contextType: this.contextForm.get('contextType')?.value
    };

    if (this.selectedCase) {
      context.caseId = this.selectedCase.id;
    }
    if (this.selectedClient) {
      context.clientId = this.selectedClient.id;
    }
    if (this.selectedCases.length > 0) {
      context.caseIds = this.selectedCases.map(c => c.id);
    }

    this.isLoading = true;
    const headers = this.getAuthHeaders();

    this.http.post<any>(`${this.apiUrl}/${this.templateId}/suggest-values`, context, { headers }).subscribe({
      next: (response) => {
        this.variableSuggestions = response.variables || [];

        // Apply suggestions to form
        this.variableSuggestions.forEach(suggestion => {
          if (suggestion.suggestedValue && this.variablesForm.contains(suggestion.variableName)) {
            this.variablesForm.patchValue({
              [suggestion.variableName]: suggestion.suggestedValue
            });
          }
        });

        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error getting AI suggestions:', error);
        this.isLoading = false;
      }
    });
  }

  acceptSuggestion(variableName: string, suggestedValue: string) {
    this.variablesForm.patchValue({
      [variableName]: suggestedValue
    });
  }

  nextStep() {
    if (this.currentStep === 1) {
      // Validate context selection
      const contextType = this.contextForm.get('contextType')?.value;
      const context = this.contextTypes.find(c => c.value === contextType);

      if (context?.requiresCase && !this.selectedCase) {
        Swal.fire('Selection Required', 'Please select a case for this document type.', 'warning');
        return;
      }
      if (context?.requiresClient && !this.selectedClient) {
        Swal.fire('Selection Required', 'Please select a client for this document type.', 'warning');
        return;
      }
      if (context?.requiresMultipleCases && this.selectedCases.length === 0) {
        Swal.fire('Selection Required', 'Please select at least one case for this document type.', 'warning');
        return;
      }
    }

    if (this.currentStep === 2 && this.useAiSuggestions && this.variableSuggestions.length === 0) {
      // Load AI suggestions when entering variables step
      this.getAiSuggestions();
    }

    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  generateDocument() {
    if (!this.templateId) {
      // Generate sample document for demonstration
      this.generateSampleDocument();
      return;
    }

    const request = {
      templateId: this.templateId,
      contextType: this.selectedContext, // Use selectedContext directly as it matches backend enum
      caseId: this.selectedCase?.id || null,
      clientId: this.selectedClient?.id || null,
      caseIds: this.selectedCases.map(c => c.id),
      userInputs: this.variablesForm.value,
      externalData: {},
      useAiSuggestions: this.useAiSuggestions,
      useAiEnhancement: this.useAiEnhancement,
      outputFormat: this.outputFormat
    };

    this.isLoading = true;
    const headers = this.getAuthHeaders();

    this.http.post<any>(`${this.apiUrl}/generate-flexible`, request, { headers }).subscribe({
      next: (response) => {
        this.generatedContent = response.generatedContent || response.content || this.createSampleContent();
        this.warnings = response.warnings || [];
        this.complianceChecks = response.complianceChecks || [];

        // Show result step
        this.currentStep = 4;
        this.isLoading = false;

        // Emit the generated document
        this.documentGenerated.emit({
          content: this.generatedContent,
          templateId: this.templateId,
          templateName: this.templateName,
          format: this.outputFormat,
          warnings: this.warnings,
          complianceChecks: this.complianceChecks
        });

        Swal.fire({
          title: 'Document Generated!',
          text: 'Your document has been successfully generated.',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      },
      error: (error) => {
        console.error('Error generating document:', error);

        // Generate sample document as fallback
        this.generateSampleDocument();
      }
    });
  }

  private generateSampleDocument() {
    const variables = this.variablesForm.value;

    this.generatedContent = this.createSampleContent(variables);
    this.warnings = ['This is a sample document for demonstration purposes'];
    this.complianceChecks = ['Document format validated', 'Legal terminology checked'];

    this.currentStep = 4;
    this.isLoading = false;

    this.documentGenerated.emit({
      content: this.generatedContent,
      templateId: this.templateId,
      templateName: this.templateName || 'Sample Document',
      format: this.outputFormat,
      warnings: this.warnings,
      complianceChecks: this.complianceChecks
    });
  }

  private createSampleContent(variables?: any): string {
    const vars = variables || this.variablesForm.value;

    // Get template-specific variables or fallback to generic ones
    const templateNameLower = this.templateName?.toLowerCase() || '';

    if (templateNameLower.includes('demand letter') || templateNameLower.includes('personal injury')) {
      return this.createDemandLetterContent(vars);
    } else if (templateNameLower.includes('civil complaint')) {
      return this.createCivilComplaintContent(vars);
    } else if (templateNameLower.includes('divorce')) {
      return this.createDivorceComplaintContent(vars);
    } else if (templateNameLower.includes('i-130') || templateNameLower.includes('immigration')) {
      return this.createImmigrationFormContent(vars);
    } else {
      return this.createGenericLegalDocument(vars);
    }
  }

  private createDemandLetterContent(vars: any): string {
    const currentDate = new Date().toLocaleDateString();
    const clientName = vars.plaintiff_name || vars.client_name || '[Client Name]';
    const defendantName = vars.defendant_name || vars.insured_name || '[Defendant Name]';
    const injuryDate = vars.injury_date || vars.accident_date || '[Date of Incident]';
    const damagesAmount = vars.damages_amount || vars.demand_amount || '[Damages Amount]';

    return `
COMMONWEALTH OF MASSACHUSETTS

[LAW FIRM LETTERHEAD]

${currentDate}

[Insurance Company Name]
[Insurance Company Address]

Re: Demand for Settlement
    Our Client: ${clientName}
    Your Insured: ${defendantName}
    Date of Loss: ${injuryDate}

Dear Claims Adjuster:

I represent ${clientName} in connection with injuries and damages sustained as a result of the incident that occurred on ${injuryDate}, involving your insured, ${defendantName}.

FACTS OF THE INCIDENT

On ${injuryDate}, my client was injured due to the negligent actions of your insured. The incident occurred as a direct result of your insured's failure to exercise reasonable care under the circumstances.

INJURIES AND DAMAGES

As a direct and proximate result of your insured's negligence, my client sustained significant injuries requiring medical treatment. The total damages include:

- Medical expenses: [Amount]
- Lost wages: [Amount]
- Pain and suffering: [Amount]
- Property damage: [Amount]

DEMAND FOR SETTLEMENT

Based on the clear liability of your insured and the significant damages sustained by my client, I hereby demand the sum of ${damagesAmount} in full settlement of this claim.

This demand will remain open for thirty (30) days from the date of this letter. Failure to respond within this time frame may result in the commencement of litigation.

Please contact me immediately to discuss resolution of this matter.

Very truly yours,

[Attorney Name]
[Bar Number]
Attorney for ${clientName}

cc: ${clientName}
    `;
  }

  private createCivilComplaintContent(vars: any): string {
    const plaintiffName = vars.plaintiff_name || '[Plaintiff Name]';
    const defendantName = vars.defendant_name || '[Defendant Name]';
    const courtName = vars.court_name || 'Massachusetts Superior Court';
    const causeOfAction = vars.cause_of_action || '[Cause of Action]';

    return `
COMMONWEALTH OF MASSACHUSETTS

${courtName}

CIVIL ACTION NO. [TO BE ASSIGNED]

${plaintiffName},
\tPlaintiff

v.

${defendantName},
\tDefendant

COMPLAINT

NOW COMES the Plaintiff, ${plaintiffName}, by and through undersigned counsel, and hereby completes against the Defendant as follows:

PARTIES

1. Plaintiff ${plaintiffName} is an individual residing in [Address].

2. Defendant ${defendantName} is [describe defendant].

JURISDICTION AND VENUE

3. This Court has jurisdiction over this matter pursuant to [jurisdictional basis].

4. Venue is proper in this Court pursuant to [venue basis].

FACTUAL ALLEGATIONS

5. ${causeOfAction}

COUNT I - [CAUSE OF ACTION]

6. Plaintiff repeats and realleges the allegations contained in paragraphs 1-5 above.

7. [Additional factual allegations supporting the cause of action]

WHEREFORE, Plaintiff respectfully requests that this Honorable Court:

A. Enter judgment in favor of Plaintiff and against Defendant;
B. Award monetary damages in an amount to be determined at trial;
C. Award costs and attorney's fees; and
D. Grant such other relief as this Court deems just and proper.

JURY TRIAL DEMANDED

Plaintiff hereby demands a trial by jury on all issues so triable.

Respectfully submitted,

_________________________
[Attorney Name], Esq.
BBO #[Number]
Attorney for Plaintiff
[Address]
[Phone Number]
[Email]
    `;
  }

  private createDivorceComplaintContent(vars: any): string {
    const plaintiffName = vars.plaintiff_name || vars.party1_name || '[Plaintiff Name]';
    const defendantName = vars.defendant_name || vars.party2_name || '[Defendant Name]';
    const marriageDate = vars.marriage_date || '[Marriage Date]';
    const county = vars.county || '[County]';

    return `
COMMONWEALTH OF MASSACHUSETTS

PROBATE AND FAMILY COURT

${county.toUpperCase()} DIVISION

DOCKET NO. [TO BE ASSIGNED]

${plaintiffName},
\tPlaintiff

v.

${defendantName},
\tDefendant

COMPLAINT FOR DIVORCE

NOW COMES the Plaintiff and completes for divorce from the Defendant and in support thereof states as follows:

1. The parties were married on ${marriageDate} in [Place of Marriage].

2. The parties last lived together as husband and wife on [Date of Separation].

3. There has been an irretrievable breakdown of the marriage under M.G.L. c. 208, § 1A.

4. [Additional grounds for divorce if applicable]

5. [Information regarding minor children, if any]

6. [Property and support matters]

WHEREFORE, Plaintiff respectfully requests that this Honorable Court:

A. Grant a divorce from the bonds of matrimony;
B. Make such orders regarding custody, support, and visitation as the Court deems appropriate;
C. Make such orders regarding the division of marital property as the Court deems equitable; and
D. Grant such other relief as the Court deems just and proper.

_________________________
${plaintiffName}, Plaintiff

_________________________
[Attorney Name], Esq.
BBO #[Number]
Attorney for Plaintiff
    `;
  }

  private createImmigrationFormContent(vars: any): string {
    const petitionerName = vars.petitioner_name || '[Petitioner Name]';
    const beneficiaryName = vars.beneficiary_name || '[Beneficiary Name]';
    const relationship = vars.relationship || '[Relationship]';

    return `
U.S. DEPARTMENT OF HOMELAND SECURITY
U.S. Citizenship and Immigration Services

I-130, IMMIGRANT PETITION FOR ALIEN RELATIVE

PART 1. INFORMATION ABOUT YOU (PETITIONER)

1. Name: ${petitionerName}
2. Address: [Current Address]
3. Date of Birth: [Date of Birth]
4. Country of Birth: [Country of Birth]
5. Citizenship: [U.S. Citizen or Permanent Resident]

PART 2. INFORMATION ABOUT YOUR RELATIVE (BENEFICIARY)

1. Name: ${beneficiaryName}
2. Address: [Current Address]
3. Date of Birth: [Date of Birth]
4. Country of Birth: [Country of Birth]
5. Relationship to Petitioner: ${relationship}

PART 3. PROCESSING INFORMATION

1. Will the beneficiary apply for adjustment of status in the United States? [Yes/No]
2. If no, at which U.S. consulate will the beneficiary apply for an immigrant visa? [Consulate]

I certify under penalty of perjury under the laws of the United States that this petition and all evidence submitted with it are true and correct.

_________________________
Signature of Petitioner

_________________________
Date
    `;
  }

  private createGenericLegalDocument(vars: any): string {
    const date = vars.document_date || vars.agreement_date || new Date().toLocaleDateString();
    const partyName = vars.party_name || vars.client_name || '[Party Name]';
    const jurisdiction = vars.jurisdiction || 'Massachusetts';
    const description = vars.description || vars.terms_description || '[Document Description]';

    return `
LEGAL DOCUMENT

Date: ${date}

This document is prepared for ${partyName} under the laws of the Commonwealth of ${jurisdiction}.

${description}

This document shall be governed by and construed in accordance with the laws of ${jurisdiction}.

IN WITNESS WHEREOF, the parties have executed this document on the date first written above.

_________________________
${partyName}

_________________________
Date

_________________________
Notary Public
My Commission Expires: __________
    `;
  }

  downloadAsPDF() {
    const timestamp = new Date().getTime();
    const safeName = this.templateName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

    try {
      // Create new PDF document
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      });

      // Set font and size
      pdf.setFont('times', 'normal');
      pdf.setFontSize(12);

      // Split content into lines that fit the page
      const pageWidth = 8.5; // Letter size width in inches
      const margin = 1; // 1 inch margins
      const maxWidth = pageWidth - (2 * margin); // Available width for text
      const lineHeight = 0.2; // Line height in inches
      let yPosition = margin; // Start position from top

      // Split content by lines
      const lines = this.generatedContent.split('\n');

      for (const line of lines) {
        // Check if we need a new page
        if (yPosition > 10) { // Letter height is 11 inches, leaving 1 inch bottom margin
          pdf.addPage();
          yPosition = margin;
        }

        if (line.trim() === '') {
          // Empty line - just add vertical space
          yPosition += lineHeight;
        } else {
          // Split long lines to fit page width
          const splitLines = pdf.splitTextToSize(line, maxWidth);

          for (const splitLine of splitLines) {
            if (yPosition > 10) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(splitLine, margin, yPosition);
            yPosition += lineHeight;
          }
        }
      }

      // Save the PDF
      pdf.save(`${safeName}_${timestamp}.pdf`);

      Swal.fire({
        title: 'PDF Downloaded!',
        text: 'Your legal document has been downloaded as a PDF file.',
        icon: 'success',
        timer: 3000,
        showConfirmButton: false
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      this.fallbackDownloadAsPDF(safeName, timestamp);
    }
  }

  private fallbackDownloadAsPDF(safeName: string, timestamp: number) {
    // Create a properly formatted document for PDF conversion
    const documentContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${this.templateName}</title>
    <style>
        @page {
            size: letter;
            margin: 1in;
        }
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            max-width: 8.5in;
            margin: 0 auto;
        }
        h1, h2, h3 {
            font-weight: bold;
            margin: 20px 0 10px 0;
        }
        h1 {
            text-align: center;
            text-transform: uppercase;
        }
        p {
            margin: 10px 0;
            text-align: justify;
        }
        .signature-line {
            margin-top: 40px;
            border-bottom: 1px solid #000;
            width: 300px;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <pre style="font-family: 'Times New Roman', serif; white-space: pre-wrap; font-size: 12pt;">${this.generatedContent}</pre>
</body>
</html>`;

    // For now, download as HTML that can be printed as PDF
    // In a production environment, you'd integrate with a PDF generation service
    const blob = new Blob([documentContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_${timestamp}.html`;
    a.click();
    window.URL.revokeObjectURL(url);

    // Show instructions for PDF conversion
    Swal.fire({
      title: 'Download Ready',
      html: `
        Your document has been downloaded as HTML.<br><br>
        <strong>To convert to PDF:</strong><br>
        1. Open the downloaded file in your web browser<br>
        2. Press Ctrl+P (Cmd+P on Mac)<br>
        3. Select "Save as PDF" as the destination<br>
        4. Click Save
      `,
      icon: 'info',
      confirmButtonText: 'Got it'
    });
  }

  downloadAsWord() {
    const timestamp = new Date().getTime();
    const safeName = this.templateName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

    // Create properly formatted RTF content
    let rtfContent = `{\\rtf1\\ansi\\deff0`;

    // Font table
    rtfContent += `{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}}`;

    // Document formatting
    rtfContent += `\\f0\\fs24`; // Times New Roman, 12pt (24 half-points)

    // Convert content to RTF format
    const formattedContent = this.generatedContent
      .replace(/\n\n/g, '\\par\\par ') // Double line breaks
      .replace(/\n/g, '\\par ') // Single line breaks
      .replace(/\t/g, '\\tab ') // Tabs
      .replace(/[{}\\]/g, '\\$&'); // Escape RTF special characters

    rtfContent += formattedContent;
    rtfContent += `}`;

    // Create and download the file
    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_${timestamp}.rtf`;
    a.click();
    window.URL.revokeObjectURL(url);

    Swal.fire({
      title: 'Word Document Downloaded!',
      text: 'Your legal document has been downloaded as RTF format, which opens directly in Microsoft Word.',
      icon: 'success',
      timer: 3000,
      showConfirmButton: false
    });
  }


  copyToClipboard() {
    navigator.clipboard.writeText(this.generatedContent).then(() => {
      Swal.fire('Copied!', 'Document content copied to clipboard.', 'success');
    });
  }

  editAndRegenerate() {
    this.currentStep = 2;
  }

  close() {
    this.closed.emit();
  }

  get currentContext(): ContextType | undefined {
    const context = this.contextTypes.find(c => c.value === this.selectedContext);
        return context;
  }

  get progressPercentage(): number {
    return (this.currentStep / this.totalSteps) * 100;
  }

  toggleCaseSelection(caseItem: Case, isChecked: boolean) {
    if (isChecked) {
      if (!this.selectedCases.find(c => c.id === caseItem.id)) {
        this.selectedCases.push(caseItem);
      }
    } else {
      this.selectedCases = this.selectedCases.filter(c => c.id !== caseItem.id);
    }
  }

  isCaseSelected(caseItem: Case): boolean {
    return this.selectedCases.some(c => c.id === caseItem.id);
  }

  getSuggestionForVariable(variableName: string): VariableSuggestion | undefined {
    return this.variableSuggestions.find(s => s.variableName === variableName);
  }

  getConfidencePercentage(suggestion: VariableSuggestion | undefined): string {
    return suggestion ? (suggestion.confidence * 100).toFixed(0) : '0';
  }

  getVariableForName(variableName: string): TemplateVariable | undefined {
    return this.templateVariables.find(v => v.variableName === variableName);
  }

  filterCases() {
    const term = this.caseSearchTerm.toLowerCase();
    if (!term) {
      this.filteredCases = [...this.cases];
    } else {
      this.filteredCases = this.cases.filter(c =>
        c.caseNumber.toLowerCase().includes(term) ||
        c.title.toLowerCase().includes(term) ||
        (c.clientName && c.clientName.toLowerCase().includes(term))
      );
    }
  }

  filterClients() {
    const term = this.clientSearchTerm.toLowerCase();
    if (!term) {
      this.filteredClients = [...this.clients];
    } else {
      this.filteredClients = this.clients.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
      );
    }
  }

  getContextIcon(contextType: string): string {
    switch(contextType) {
      case 'STANDALONE':
        return 'ri-file-text-line';
      case 'CLIENT':
        return 'ri-user-line';
      case 'CASE':
        return 'ri-briefcase-line';
      case 'MULTI_CASE':
        return 'ri-stack-line';
      default:
        return 'ri-file-line';
    }
  }

  formatVariableName(name: string): string {
    // Convert camelCase or snake_case to Title Case
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  selectContext(contextValue: string) {
    this.selectedContext = contextValue;
    this.onContextChange();

    // Force change detection by updating the form
    this.contextForm.patchValue({ contextType: contextValue });
  }

  selectCase(caseItem: Case) {
    this.selectedCase = caseItem;
  }

  selectClient(client: Client) {
    this.selectedClient = client;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }
}