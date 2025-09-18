import { Component, ChangeDetectorRef } from '@angular/core';
import { AiAssistantService } from '../../../../service/ai-assistant.service';

@Component({
  selector: 'app-document-analyzer',
  template: `
    <div class="container-fluid" style="margin-top: 120px;">
      <!-- Breadcrumb -->
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="/legal">Legal</a></li>
          <li class="breadcrumb-item active">Document Analyzer</li>
        </ol>
      </nav>

      <div class="row" style="margin-bottom:60px;">
        <div class="col-12">
          <div class="card shadow-sm border-0">
            <div class="card-header bg-light-subtle border-bottom-dashed">
              <h5 class="card-title mb-0 text-primary">
                <i class="ri-file-text-line me-2"></i>AI Document Analyzer
              </h5>
            </div>
            <div class="card-body">
              <div class="row g-4">
                <!-- Input Section -->
                <div class="col-lg-5">
                  <div class="mb-3">
                    <label class="form-label fw-semibold text-muted">
                      Document Text <span class="text-danger">*</span>
                    </label>
                    <textarea 
                      class="form-control" 
                      rows="10" 
                      [(ngModel)]="documentText"
                      placeholder="Paste document content here for AI analysis..."
                      [disabled]="loading">
                    </textarea>
                  </div>
                  
                  <div class="row g-3 mb-3">
                    <div class="col-md-6">
                      <label class="form-label fw-semibold text-muted">Document Type</label>
                      <select class="form-select" [(ngModel)]="documentType" [disabled]="loading">
                        <option value="contract">Contract</option>
                        <option value="lease">Lease Agreement</option>
                        <option value="employment">Employment Agreement</option>
                        <option value="legal_brief">Legal Brief</option>
                        <option value="court_filing">Court Filing</option>
                        <option value="settlement">Settlement Agreement</option>
                        <option value="general">General Document</option>
                      </select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label fw-semibold text-muted">Analysis Mode</label>
                      <select class="form-select" [(ngModel)]="analysisMode" [disabled]="loading">
                        <option value="instant">⚡ Instant (2-3 sec)</option>
                        <option value="deep">🧠 Deep Thinking (30-60 sec)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div class="d-flex gap-2 flex-wrap">
                    <button 
                      class="btn btn-soft-primary btn-animation waves-effect waves-light"
                      (click)="quickSummary()" 
                      [disabled]="loading || !documentText.trim()">
                      <span *ngIf="loading && currentAction === 'summary'" class="spinner-border spinner-border-sm me-1"></span>
                      <i class="ri-file-list-line me-1" *ngIf="!loading || currentAction !== 'summary'"></i>
                      {{ loading && currentAction === 'summary' ? 'Summarizing...' : 'Quick Summary' }}
                    </button>
                    
                    <button 
                      class="btn btn-soft-success btn-animation waves-effect waves-light"
                      (click)="extractKeyTerms()" 
                      [disabled]="loading || !documentText.trim()">
                      <span *ngIf="loading && currentAction === 'terms'" class="spinner-border spinner-border-sm me-1"></span>
                      <i class="ri-key-line me-1" *ngIf="!loading || currentAction !== 'terms'"></i>
                      {{ loading && currentAction === 'terms' ? 'Extracting...' : 'Key Terms' }}
                    </button>
                    
                    <button 
                      class="btn btn-soft-warning btn-animation waves-effect waves-light"
                      (click)="riskAssessment()" 
                      [disabled]="loading || !documentText.trim()">
                      <span *ngIf="loading && currentAction === 'risk'" class="spinner-border spinner-border-sm me-1"></span>
                      <i class="ri-alert-line me-1" *ngIf="!loading || currentAction !== 'risk'"></i>
                      {{ loading && currentAction === 'risk' ? 'Analyzing...' : 'Risk Analysis' }}
                    </button>
                    
                    <button 
                      class="btn btn-soft-secondary"
                      (click)="loadSampleDocument()" 
                      [disabled]="loading">
                      <i class="ri-file-copy-line me-1"></i>Load Sample
                    </button>
                  </div>
                </div>

                <!-- Results Section -->
                <div class="col-lg-7">
                  <div class="card border shadow-none h-100">
                    <div class="card-header bg-light">
                      <div class="d-flex justify-content-between align-items-center">
                        <h6 class="card-title mb-0">Analysis Results</h6>
                        <span class="badge bg-info-subtle text-info" *ngIf="analysisMode === 'deep'">
                          Deep Thinking Mode
                        </span>
                      </div>
                    </div>
                    <div class="card-body">
                      <!-- Loading State -->
                      <div class="text-center py-5" *ngIf="loading">
                        <div class="spinner-border text-primary mb-3"></div>
                        <p class="text-muted mb-2">
                          <strong>Claude Sonnet 4</strong> is analyzing your document...
                        </p>
                        <small class="text-muted">
                          {{ analysisMode === 'deep' ? 'Deep thinking in progress (30-60 seconds)' : 'Processing...' }}
                        </small>
                      </div>

                      <!-- Error State -->
                      <div class="alert alert-danger" *ngIf="error && !loading">
                        <i class="ri-error-warning-line me-2"></i>
                        {{ error }}
                      </div>

                      <!-- Results -->
                      <div *ngIf="result && !loading && !error" class="result-container">
                        <!-- Action Type Badge -->
                        <div class="mb-3">
                          <span class="badge"
                            [ngClass]="{
                              'bg-primary-subtle text-primary': currentAction === 'summary',
                              'bg-success-subtle text-success': currentAction === 'terms',
                              'bg-warning-subtle text-warning': currentAction === 'risk'
                            }">
                            {{ getActionLabel() }}
                          </span>
                          <span class="badge bg-light-subtle text-muted ms-2">{{ documentType | titlecase }}</span>
                        </div>

                        <!-- Analysis Content -->
                        <div class="analysis-content">
                          <pre class="analysis-text">{{ result }}</pre>
                        </div>

                        <!-- Action Buttons -->
                        <div class="mt-4 d-flex gap-2">
                          <button class="btn btn-sm btn-soft-secondary" (click)="copyToClipboard()">
                            <i class="ri-file-copy-line me-1"></i>Copy
                          </button>
                          <button class="btn btn-sm btn-soft-info" (click)="downloadResult()">
                            <i class="ri-download-line me-1"></i>Download
                          </button>
                        </div>
                      </div>

                      <!-- Empty State -->
                      <div class="text-center py-5" *ngIf="!result && !loading && !error">
                        <div class="avatar-lg mx-auto mb-3">
                          <div class="avatar-title rounded-circle bg-soft-primary text-primary">
                            <i class="ri-file-text-line display-6"></i>
                          </div>
                        </div>
                        <h6 class="mb-2">Ready to Analyze</h6>
                        <p class="text-muted small">Upload or paste document content and select an analysis type</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analysis-text {
      font-family: inherit;
      font-size: 14px;
      line-height: 1.6;
      background: none;
      border: none;
      padding: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      max-height: 400px;
      overflow-y: auto;
    }
    .result-container {
      border-left: 3px solid #6691e7;
      padding-left: 1rem;
    }
    .analysis-content {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1rem;
      border: 1px solid #e3e6e9;
    }
  `]
})
export class DocumentAnalyzerComponent {
  documentText = '';
  documentType = 'contract';
  analysisMode = 'instant';
  result = '';
  error = '';
  loading = false;
  currentAction: 'summary' | 'terms' | 'risk' = 'summary';

  constructor(
    private aiService: AiAssistantService,
    private cdr: ChangeDetectorRef
  ) {}

  quickSummary() {
    if (!this.documentText.trim()) return;
    
    this.loading = true;
    this.currentAction = 'summary';
    this.error = '';
    this.result = '';
    this.cdr.detectChanges();
    
    const useDeepThinking = this.analysisMode === 'deep';
    
    this.aiService.analyzeDocument(this.documentText, this.documentType, 'summary')
      .subscribe({
        next: (response) => {
          this.result = response.analysis;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.error || 'Summary generation failed';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  extractKeyTerms() {
    if (!this.documentText.trim()) return;
    
    this.loading = true;
    this.currentAction = 'terms';
    this.error = '';
    this.result = '';
    this.cdr.detectChanges();
    
    this.aiService.extractKeyTerms(this.documentText)
      .subscribe({
        next: (response) => {
          this.result = response.keyTerms;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.error || 'Key terms extraction failed';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  riskAssessment() {
    if (!this.documentText.trim()) return;
    
    this.loading = true;
    this.currentAction = 'risk';
    this.error = '';
    this.result = '';
    this.cdr.detectChanges();
    
    this.aiService.riskAssessment(this.documentText)
      .subscribe({
        next: (response) => {
          this.result = response.riskAssessment;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.error || 'Risk assessment failed';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  loadSampleDocument() {
    this.documentText = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on March 15, 2024, between DataTech Innovations LLC ("Disclosing Party") and Alex Morgan ("Receiving Party").

CONFIDENTIAL INFORMATION:
The Disclosing Party may share proprietary technology specifications, business strategies, customer lists, financial data, and product development plans with the Receiving Party.

OBLIGATIONS:
1. The Receiving Party agrees to maintain strict confidentiality of all disclosed information
2. Information shall not be used for any purpose other than evaluating potential business collaboration
3. No copies or reproductions of confidential materials without written consent
4. Return or destroy all confidential information upon request

TERM: This agreement shall remain in effect for 5 years from the date of signing.

EXCEPTIONS: Publicly available information, independently developed information, and information received from third parties without breach of confidentiality obligations are excluded.

REMEDIES: Breach of this agreement may result in immediate injunctive relief and monetary damages.

GOVERNING LAW: This agreement shall be governed by the laws of Delaware.

Signed: DataTech Innovations LLC, Alex Morgan`;
    
    this.result = '';
    this.error = '';
  }

  getActionLabel(): string {
    switch (this.currentAction) {
      case 'summary': return 'Document Summary';
      case 'terms': return 'Key Terms Extraction';
      case 'risk': return 'Risk Assessment';
      default: return 'Analysis';
    }
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.result).then(() => {
      // Could add a toast notification here
    });
  }

  downloadResult() {
    const blob = new Blob([this.result], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.getActionLabel()}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}