import { Component, ChangeDetectorRef } from '@angular/core';
import { AiAssistantService } from '../../../../service/ai-assistant.service';

@Component({
  selector: 'app-contract-risk-scanner',
  template: `
    <div class="container-fluid" style="margin-top: 120px;">
      <!-- Breadcrumb -->
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="/legal">Legal</a></li>
          <li class="breadcrumb-item active">Contract Risk Scanner</li>
        </ol>
      </nav>

      <div class="row" style="margin-bottom:60px;">
        <div class="col-12">
          <div class="card shadow-sm border-0">
            <div class="card-header bg-light-subtle border-bottom-dashed">
              <h5 class="card-title mb-0 text-primary">
                <i class="ri-shield-check-line me-2"></i>Contract Risk Scanner
              </h5>
            </div>
            <div class="card-body">
              <div class="row g-4">
                <!-- Input Section -->
                <div class="col-lg-6">
                  <div class="mb-3">
                    <label class="form-label fw-semibold text-muted">
                      Contract Text <span class="text-danger">*</span>
                    </label>
                    <textarea 
                      class="form-control" 
                      rows="12" 
                      [(ngModel)]="contractText"
                      placeholder="Paste your contract text here for AI analysis..."
                      [disabled]="loading">
                    </textarea>
                  </div>
                  
                  <div class="d-flex gap-2 flex-wrap">
                    <button 
                      class="btn btn-soft-primary btn-animation waves-effect waves-light"
                      (click)="quickRiskScan()" 
                      [disabled]="loading || !contractText.trim()">
                      <span *ngIf="loading && scanType === 'quick'" class="spinner-border spinner-border-sm me-1"></span>
                      <i class="ri-flashlight-line me-1" *ngIf="!loading || scanType !== 'quick'"></i>
                      {{ loading && scanType === 'quick' ? 'Scanning...' : 'Quick Risk Scan' }}
                    </button>
                    
                    <button 
                      class="btn btn-soft-success btn-animation waves-effect waves-light"
                      (click)="fullAnalysis()" 
                      [disabled]="loading || !contractText.trim()">
                      <span *ngIf="loading && scanType === 'full'" class="spinner-border spinner-border-sm me-1"></span>
                      <i class="ri-search-2-line me-1" *ngIf="!loading || scanType !== 'full'"></i>
                      {{ loading && scanType === 'full' ? 'Analyzing...' : 'Full Analysis' }}
                    </button>
                    
                    <button 
                      class="btn btn-soft-secondary"
                      (click)="loadSampleContract()" 
                      [disabled]="loading">
                      <i class="ri-file-text-line me-1"></i>Load Sample
                    </button>
                  </div>
                </div>

                <!-- Results Section -->
                <div class="col-lg-6">
                  <div class="card border shadow-none">
                    <div class="card-header bg-light">
                      <h6 class="card-title mb-0">Risk Assessment Results</h6>
                    </div>
                    <div class="card-body">
                      <!-- Loading State -->
                      <div class="text-center py-4" *ngIf="loading">
                        <div class="spinner-border text-primary mb-3"></div>
                        <p class="text-muted">
                          <strong>Claude Sonnet 4</strong> is analyzing your contract...
                        </p>
                      </div>

                      <!-- Error State -->
                      <div class="alert alert-danger" *ngIf="error && !loading">
                        <i class="ri-error-warning-line me-2"></i>
                        {{ error }}
                      </div>

                      <!-- Results -->
                      <div *ngIf="assessment && !loading && !error">
                        <!-- Risk Score -->
                        <div class="mb-4">
                          <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="fw-semibold">Risk Score</span>
                            <span class="badge"
                              [ngClass]="{
                                'bg-success-subtle text-success': assessment.overallRiskScore <= 30,
                                'bg-warning-subtle text-warning': assessment.overallRiskScore > 30 && assessment.overallRiskScore <= 70,
                                'bg-danger-subtle text-danger': assessment.overallRiskScore > 70
                              }">
                              {{ assessment.overallRiskScore }}/100
                            </span>
                          </div>
                          <div class="progress" style="height: 8px;">
                            <div class="progress-bar"
                              [ngClass]="{
                                'bg-success': assessment.overallRiskScore <= 30,
                                'bg-warning': assessment.overallRiskScore > 30 && assessment.overallRiskScore <= 70,
                                'bg-danger': assessment.overallRiskScore > 70
                              }"
                              [style.width.%]="assessment.overallRiskScore">
                            </div>
                          </div>
                        </div>

                        <!-- Risk Level -->
                        <div class="mb-3">
                          <span class="badge text-uppercase fw-semibold"
                            [ngClass]="{
                              'bg-success-subtle text-success': assessment.riskLevel === 'LOW',
                              'bg-warning-subtle text-warning': assessment.riskLevel === 'MEDIUM',
                              'bg-danger-subtle text-danger': assessment.riskLevel === 'HIGH' || assessment.riskLevel === 'CRITICAL'
                            }">
                            {{ assessment.riskLevel }} RISK
                          </span>
                        </div>

                        <!-- Summary -->
                        <div class="mb-3" *ngIf="assessment.summary">
                          <h6 class="text-muted mb-2">Summary</h6>
                          <p class="small">{{ assessment.summary }}</p>
                        </div>

                        <!-- Recommendations -->
                        <div *ngIf="assessment.recommendations">
                          <h6 class="text-muted mb-2">Recommendations</h6>
                          <div class="alert alert-info-subtle">
                            <pre class="mb-0 small" style="white-space: pre-wrap;">{{ assessment.recommendations }}</pre>
                          </div>
                        </div>
                      </div>

                      <!-- Empty State -->
                      <div class="text-center py-4" *ngIf="!assessment && !loading && !error">
                        <div class="avatar-lg mx-auto mb-3">
                          <div class="avatar-title rounded-circle bg-soft-primary text-primary">
                            <i class="ri-shield-check-line display-6"></i>
                          </div>
                        </div>
                        <h6 class="mb-2">Ready to Scan</h6>
                        <p class="text-muted small">Enter contract text and click scan to analyze risks</p>
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
    .progress {
      border-radius: 4px;
    }
    pre {
      font-family: inherit;
      font-size: inherit;
      background: none;
      border: none;
      padding: 0;
    }
    .card-animate {
      transition: transform 0.2s ease;
    }
    .card-animate:hover {
      transform: translateY(-1px);
    }
  `]
})
export class ContractRiskScannerComponent {
  contractText = '';
  assessment: any = null;
  error = '';
  loading = false;
  scanType: 'quick' | 'full' = 'quick';

  constructor(
    private aiService: AiAssistantService,
    private cdr: ChangeDetectorRef
  ) {}

  quickRiskScan() {
    if (!this.contractText.trim()) return;
    
    this.loading = true;
    this.scanType = 'quick';
    this.error = '';
    this.assessment = null;
    this.cdr.detectChanges();
    
    this.aiService.quickRiskScan(this.contractText)
      .subscribe({
        next: (response) => {
          this.assessment = response.assessment;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.error || 'Quick scan failed';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  fullAnalysis() {
    if (!this.contractText.trim()) return;
    
    this.loading = true;
    this.scanType = 'full';
    this.error = '';
    this.assessment = null;
    this.cdr.detectChanges();
    
    this.aiService.analyzeContract(this.contractText)
      .subscribe({
        next: (response) => {
          this.assessment = response.assessment;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.error || 'Full analysis failed';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  loadSampleContract() {
    this.contractText = `EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into on January 15, 2024, between TechCorp Solutions Inc. ("Company") and Sarah Johnson ("Employee").

TERMS AND CONDITIONS:

1. POSITION: Employee shall serve as Senior Software Developer
2. COMPENSATION: $120,000 annual salary, paid bi-weekly
3. BENEFITS: Health insurance, 401(k) matching up to 4%
4. VACATION: 15 days paid vacation per year
5. TERMINATION: Either party may terminate with 30 days written notice
6. CONFIDENTIALITY: Employee agrees to maintain confidentiality of proprietary information
7. NON-COMPETE: Employee agrees not to work for competitors within 50 miles for 2 years after termination
8. INTELLECTUAL PROPERTY: All work products belong to Company

This agreement shall be governed by the laws of California.

Signed: TechCorp Solutions Inc., Sarah Johnson`;
    
    this.assessment = null;
    this.error = '';
  }
}