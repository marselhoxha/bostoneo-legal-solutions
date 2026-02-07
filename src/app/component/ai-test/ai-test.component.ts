import { Component, ChangeDetectorRef } from '@angular/core';
import { AiAssistantService } from '../../service/ai-assistant.service';

@Component({
  selector: 'app-ai-test',
  template: `
    <div class="container mt-4">
      <h2>🤖 AI Assistant Test</h2>
      
      <div class="row">
        <div class="col-md-6">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">Document Analysis</h5>
              <textarea 
                class="form-control mb-3" 
                rows="6" 
                [(ngModel)]="testDocument"
                placeholder="Paste document content here...">
              </textarea>
              
              <div class="mb-3">
                <label class="form-label">Analysis Type:</label>
                <select class="form-select" [(ngModel)]="analysisType">
                  <option value="summary">Summary</option>
                  <option value="contract_risk">Contract Risk</option>
                  <option value="classification">Case Classification</option>
                </select>
              </div>
              
              <button class="btn btn-primary me-2" (click)="analyzeDocument()" [disabled]="loading">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-1" role="status"></span>
                {{ loading ? 'Analyzing...' : 'Analyze Document' }}
              </button>
              
              <button class="btn btn-secondary me-2" (click)="quickSummary()" [disabled]="loading">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-1" role="status"></span>
                {{ loading ? 'Summarizing...' : 'Quick Summary' }}
              </button>
              
              <button class="btn btn-warning" (click)="riskAssessment()" [disabled]="loading">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-1" role="status"></span>
                {{ loading ? 'Assessing...' : 'Risk Assessment' }}
              </button>
            </div>
          </div>
        </div>
        
        <div class="col-md-6">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">AI Response</h5>
              <div class="alert alert-info d-flex align-items-center" *ngIf="loading">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <strong>Processing with Claude Sonnet 4...</strong>
              </div>
              
              <div class="alert alert-success" *ngIf="result && !loading">
                <h6>Analysis Complete:</h6>
                <pre style="white-space: pre-wrap;">{{ result }}</pre>
              </div>
              
              <div class="alert alert-danger" *ngIf="error">
                <h6>Error:</h6>
                {{ error }}
              </div>
            </div>
          </div>
          
          <div class="card mt-3" *ngIf="!apiKeySet">
            <div class="card-body">
              <h6 class="text-warning">⚠️ Setup Required</h6>
              <p>To test AI features, set the ANTHROPIC_API_KEY environment variable:</p>
              <code>export ANTHROPIC_API_KEY=your_api_key_here</code>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row mt-4">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">Health Check</h5>
              <button class="btn btn-info" (click)="checkHealth()">Check AI Service Health</button>
              <div class="mt-2" *ngIf="healthStatus">
                <span class="badge bg-success">{{ healthStatus }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    pre {
      max-height: 400px;
      overflow-y: auto;
    }
    .card {
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  `]
})
export class AiTestComponent {
  testDocument = `RENTAL AGREEMENT

This Rental Agreement is entered into on January 1, 2024, between John Smith (Landlord) and Jane Doe (Tenant) for the property located at 123 Main Street, Boston, MA.

TERMS:
- Monthly rent: $2,000
- Security deposit: $2,000  
- Lease term: 12 months
- Pet policy: No pets allowed
- Utilities: Tenant responsible for electricity and gas

The Tenant agrees to pay rent by the 1st of each month. Late fees of $50 will apply after the 5th.

Signed: John Smith, Jane Doe`;

  analysisType = 'summary';
  result = '';
  error = '';
  loading = false;
  healthStatus = '';
  apiKeySet = true; // Will be checked via health endpoint

  constructor(
    private aiService: AiAssistantService,
    private cdr: ChangeDetectorRef
  ) {}

  analyzeDocument() {
    if (!this.testDocument.trim()) return;
    
    this.loading = true;
    this.error = '';
    this.result = '';
    this.cdr.detectChanges(); // Force change detection
    
    this.aiService.analyzeDocument(this.testDocument, 'rental agreement', this.analysisType)
      .subscribe({
        next: (response) => {
          this.result = response.analysis;
          this.loading = false;
          this.cdr.detectChanges(); // Force change detection
        },
        error: (err) => {
          this.error = err.error?.error || 'Analysis failed';
          this.loading = false;
          if (this.error.includes('API key')) {
            this.apiKeySet = false;
          }
          this.cdr.detectChanges(); // Force change detection
        }
      });
  }

  quickSummary() {
    if (!this.testDocument.trim()) return;
    
    this.loading = true;
    this.error = '';
    this.result = '';
    this.cdr.detectChanges(); // Force change detection
    
    this.aiService.quickSummary(this.testDocument)
      .subscribe({
        next: (response) => {
          this.result = response.summary;
          this.loading = false;
          this.cdr.detectChanges(); // Force change detection
        },
        error: (err) => {
          this.error = err.error?.error || 'Summary failed';
          this.loading = false;
          this.cdr.detectChanges(); // Force change detection
        }
      });
  }

  riskAssessment() {
    if (!this.testDocument.trim()) return;
    
    this.loading = true;
    this.error = '';
    this.result = '';
    this.cdr.detectChanges(); // Force change detection
    
    this.aiService.riskAssessment(this.testDocument)
      .subscribe({
        next: (response) => {
          this.result = response.riskAssessment;
          this.loading = false;
          this.cdr.detectChanges(); // Force change detection
        },
        error: (err) => {
          this.error = err.error?.error || 'Risk assessment failed';
          this.loading = false;
          this.cdr.detectChanges(); // Force change detection
        }
      });
  }

  checkHealth() {
    this.aiService.checkHealth()
      .subscribe({
        next: () => {
          this.healthStatus = '✅ AI Service is healthy';
          this.apiKeySet = true;
          this.cdr.detectChanges();
        },
        error: () => {
          this.healthStatus = '❌ AI Service unavailable';
          this.apiKeySet = false;
          this.cdr.detectChanges();
        }
      });
  }
}