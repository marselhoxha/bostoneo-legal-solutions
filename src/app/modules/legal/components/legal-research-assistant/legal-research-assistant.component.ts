import { Component, ChangeDetectorRef } from '@angular/core';
import { AiAssistantService } from '../../../../service/ai-assistant.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';

@Component({
  selector: 'app-legal-research-assistant',
  template: `
    <div class="container-fluid">
      <!-- Breadcrumb -->
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="/legal">Legal</a></li>
          <li class="breadcrumb-item active">Legal Research Assistant</li>
        </ol>
      </nav>

      <div class="row" style="margin-bottom:60px;">
        <div class="col-12">
          <div class="card shadow-sm border-0">
            <div class="card-header bg-light-subtle border-bottom-dashed">
              <h5 class="card-title mb-0 text-primary">
                <i class="ri-search-2-line me-2"></i>Legal Research Assistant
              </h5>
            </div>
            <div class="card-body">
              <!-- Research Type Tabs -->
              <ul class="nav nav-tabs nav-justified mb-4" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link" 
                    [class.active]="activeTab === 'case-law'"
                    (click)="setActiveTab('case-law')"
                    type="button">
                    <i class="ri-scales-line me-1"></i>Case Law Search
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" 
                    [class.active]="activeTab === 'statute'"
                    (click)="setActiveTab('statute')"
                    type="button">
                    <i class="ri-book-line me-1"></i>Statute Interpretation
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" 
                    [class.active]="activeTab === 'precedents'"
                    (click)="setActiveTab('precedents')"
                    type="button">
                    <i class="ri-history-line me-1"></i>Find Precedents
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" 
                    [class.active]="activeTab === 'memo'"
                    (click)="setActiveTab('memo')"
                    type="button">
                    <i class="ri-file-edit-line me-1"></i>Legal Memo
                  </button>
                </li>
              </ul>

              <div class="row g-4">
                <!-- Input Section -->
                <div class="col-lg-5">
                  <!-- Case Law Search Tab -->
                  <div *ngIf="activeTab === 'case-law'">
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-muted">
                        Search Query <span class="text-danger">*</span>
                      </label>
                      <textarea 
                        class="form-control" 
                        rows="4" 
                        [(ngModel)]="caseSearchQuery"
                        placeholder="Enter legal concepts, issues, or keywords to search for relevant case law..."
                        [disabled]="loading">
                      </textarea>
                    </div>
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-muted">Jurisdiction</label>
                      <select class="form-select" [(ngModel)]="jurisdiction" [disabled]="loading">
                        <option value="Federal">Federal Courts</option>
                        <option value="California">California</option>
                        <option value="New York">New York</option>
                        <option value="Texas">Texas</option>
                        <option value="Florida">Florida</option>
                        <option value="Illinois">Illinois</option>
                        <option value="All">All Jurisdictions</option>
                      </select>
                    </div>
                    <button 
                      class="btn btn-soft-primary btn-animation waves-effect waves-light"
                      (click)="searchCaseLaw()" 
                      [disabled]="loading || !caseSearchQuery.trim()">
                      <span *ngIf="loading" class="spinner-border spinner-border-sm me-1"></span>
                      <i class="ri-search-line me-1" *ngIf="!loading"></i>
                      {{ loading ? 'Searching...' : 'Search Case Law' }}
                    </button>
                  </div>

                  <!-- Statute Interpretation Tab -->
                  <div *ngIf="activeTab === 'statute'">
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-muted">
                        Statute Text <span class="text-danger">*</span>
                      </label>
                      <textarea 
                        class="form-control" 
                        rows="6" 
                        [(ngModel)]="statuteText"
                        placeholder="Paste the statute or legal provision you need interpreted..."
                        [disabled]="loading">
                      </textarea>
                    </div>
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-muted">Jurisdiction</label>
                      <select class="form-select" [(ngModel)]="jurisdiction" [disabled]="loading">
                        <option value="Federal">Federal Law</option>
                        <option value="California">California</option>
                        <option value="New York">New York</option>
                        <option value="Texas">Texas</option>
                        <option value="Florida">Florida</option>
                        <option value="Illinois">Illinois</option>
                      </select>
                    </div>
                    <div class="d-flex gap-2">
                      <button 
                        class="btn btn-soft-success btn-animation waves-effect waves-light"
                        (click)="interpretStatute()" 
                        [disabled]="loading || !statuteText.trim()">
                        <span *ngIf="loading" class="spinner-border spinner-border-sm me-1"></span>
                        <i class="ri-book-open-line me-1" *ngIf="!loading"></i>
                        {{ loading ? 'Interpreting...' : 'Interpret Statute' }}
                      </button>
                      <button 
                        class="btn btn-soft-secondary"
                        (click)="loadSampleStatute()" 
                        [disabled]="loading">
                        <i class="ri-file-copy-line me-1"></i>Load Sample
                      </button>
                    </div>
                  </div>

                  <!-- Find Precedents Tab -->
                  <div *ngIf="activeTab === 'precedents'">
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-muted">
                        Case Description <span class="text-danger">*</span>
                      </label>
                      <textarea 
                        class="form-control" 
                        rows="5" 
                        [(ngModel)]="caseDescription"
                        placeholder="Describe the facts and legal issues of your case..."
                        [disabled]="loading">
                      </textarea>
                    </div>
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-muted">Practice Area</label>
                      <select class="form-select" [(ngModel)]="practiceArea" [disabled]="loading">
                        <option value="Personal Injury">Personal Injury</option>
                        <option value="Contract Law">Contract Law</option>
                        <option value="Employment Law">Employment Law</option>
                        <option value="Corporate Law">Corporate Law</option>
                        <option value="Criminal Law">Criminal Law</option>
                        <option value="Family Law">Family Law</option>
                        <option value="Real Estate">Real Estate</option>
                        <option value="Intellectual Property">Intellectual Property</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <button 
                      class="btn btn-soft-warning btn-animation waves-effect waves-light"
                      (click)="findPrecedents()" 
                      [disabled]="loading || !caseDescription.trim()">
                      <span *ngIf="loading" class="spinner-border spinner-border-sm me-1"></span>
                      <i class="ri-history-line me-1" *ngIf="!loading"></i>
                      {{ loading ? 'Finding...' : 'Find Precedents' }}
                    </button>
                  </div>

                  <!-- Legal Memo Tab -->
                  <div *ngIf="activeTab === 'memo'">
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-muted">
                        Topic <span class="text-danger">*</span>
                      </label>
                      <input 
                        type="text" 
                        class="form-control" 
                        [(ngModel)]="memoTopic"
                        placeholder="Legal issue or topic for the memorandum..."
                        [disabled]="loading">
                    </div>
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-muted">
                        Key Facts
                      </label>
                      <textarea 
                        class="form-control" 
                        rows="4" 
                        [(ngModel)]="keyFacts"
                        placeholder="Relevant facts and circumstances..."
                        [disabled]="loading">
                      </textarea>
                    </div>
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-muted">Jurisdiction</label>
                      <select class="form-select" [(ngModel)]="jurisdiction" [disabled]="loading">
                        <option value="Federal">Federal Law</option>
                        <option value="California">California</option>
                        <option value="New York">New York</option>
                        <option value="Texas">Texas</option>
                        <option value="Florida">Florida</option>
                        <option value="Illinois">Illinois</option>
                      </select>
                    </div>
                    <button 
                      class="btn btn-soft-info btn-animation waves-effect waves-light"
                      (click)="draftLegalMemo()" 
                      [disabled]="loading || !memoTopic.trim()">
                      <span *ngIf="loading" class="spinner-border spinner-border-sm me-1"></span>
                      <i class="ri-file-edit-line me-1" *ngIf="!loading"></i>
                      {{ loading ? 'Drafting...' : 'Draft Memo' }}
                    </button>
                  </div>
                </div>

                <!-- Results Section -->
                <div class="col-lg-7">
                  <div class="card border shadow-none h-100">
                    <div class="card-header bg-light">
                      <div class="d-flex justify-content-between align-items-center">
                        <h6 class="card-title mb-0">Research Results</h6>
                        <span class="badge bg-info-subtle text-info" *ngIf="result">
                          {{ getTabLabel() }}
                        </span>
                      </div>
                    </div>
                    <div class="card-body">
                      <!-- Loading State -->
                      <div class="text-center py-5" *ngIf="loading">
                        <div class="spinner-border text-primary mb-3"></div>
                        <p class="text-muted mb-2">
                          <strong>Claude Sonnet 4</strong> is conducting legal research...
                        </p>
                        <small class="text-muted">Deep thinking mode - this may take 30-60 seconds</small>
                      </div>

                      <!-- Error State -->
                      <div class="alert alert-danger" *ngIf="error && !loading">
                        <i class="ri-error-warning-line me-2"></i>
                        {{ error }}
                      </div>

                      <!-- Results -->
                      <div *ngIf="result && !loading && !error" class="result-container">
                        <div class="research-content">
                          <div class="research-text" [innerHTML]="result | markdown"></div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="mt-4 d-flex gap-2">
                          <button class="btn btn-sm btn-soft-secondary" (click)="copyToClipboard()">
                            <i class="ri-file-copy-line me-1"></i>Copy
                          </button>
                          <button class="btn btn-sm btn-soft-info" (click)="downloadResult()">
                            <i class="ri-download-line me-1"></i>Download
                          </button>
                          <button class="btn btn-sm btn-soft-primary" (click)="clearResults()">
                            <i class="ri-refresh-line me-1"></i>Clear
                          </button>
                        </div>
                      </div>

                      <!-- Empty State -->
                      <div class="text-center py-5" *ngIf="!result && !loading && !error">
                        <div class="avatar-lg mx-auto mb-3">
                          <div class="avatar-title rounded-circle bg-soft-primary text-primary">
                            <i class="ri-search-2-line display-6"></i>
                          </div>
                        </div>
                        <h6 class="mb-2">Legal Research Assistant</h6>
                        <p class="text-muted small">Select a research type and enter your query to get AI-powered legal insights</p>
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
    .nav-tabs .nav-link {
      border: none;
      border-bottom: 2px solid transparent;
      color: #6c757d;
    }
    .nav-tabs .nav-link.active {
      background-color: transparent;
      border-bottom-color: #6691e7;
      color: #6691e7;
    }
    .nav-tabs .nav-link:hover {
      border-bottom-color: #6691e7;
      color: #6691e7;
    }
    .research-text {
      font-family: inherit;
      font-size: 14px;
      line-height: 1.6;
      background: none;
      border: none;
      padding: 0;
      word-wrap: break-word;
      max-height: 500px;
      overflow-y: auto;
    }
    .research-text h1, .research-text h2, .research-text h3 {
      color: #495057;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }
    .research-text h1 { font-size: 1.5rem; border-bottom: 2px solid #6691e7; padding-bottom: 0.5rem; }
    .research-text h2 { font-size: 1.3rem; color: #6691e7; }
    .research-text h3 { font-size: 1.1rem; }
    .research-text ul, .research-text ol { margin-left: 1.5rem; }
    .research-text li { margin-bottom: 0.3rem; }
    .research-text strong { color: #495057; }
    .research-text p { margin-bottom: 1rem; }
    .research-text code { 
      background: #f8f9fa; 
      padding: 0.2rem 0.4rem; 
      border-radius: 0.25rem; 
      font-size: 0.9em; 
    }
    .research-text blockquote {
      border-left: 4px solid #6691e7;
      padding-left: 1rem;
      margin: 1rem 0;
      font-style: italic;
      color: #6c757d;
    }
    .result-container {
      border-left: 3px solid #6691e7;
      padding-left: 1rem;
    }
    .research-content {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
      border: 1px solid #e3e6e9;
    }
  `]
})
export class LegalResearchAssistantComponent {
  activeTab = 'case-law';
  
  // Form data
  caseSearchQuery = '';
  statuteText = '';
  caseDescription = '';
  memoTopic = '';
  keyFacts = '';
  jurisdiction = 'Federal';
  practiceArea = 'General';
  
  // Results
  result = '';
  error = '';
  loading = false;

  constructor(
    private aiService: AiAssistantService,
    private cdr: ChangeDetectorRef
  ) {}

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.clearResults();
  }

  searchCaseLaw() {
    if (!this.caseSearchQuery.trim()) return;
    
    this.loading = true;
    this.error = '';
    this.result = '';
    this.cdr.detectChanges();
    
    this.aiService.searchCaseLaw(this.caseSearchQuery, this.jurisdiction)
      .subscribe({
        next: (response) => {
          this.result = response.result;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.error || 'Case law search failed';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  interpretStatute() {
    if (!this.statuteText.trim()) return;
    
    this.loading = true;
    this.error = '';
    this.result = '';
    this.cdr.detectChanges();
    
    this.aiService.interpretStatute(this.statuteText, this.jurisdiction)
      .subscribe({
        next: (response) => {
          this.result = response.interpretation;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.error || 'Statute interpretation failed';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  findPrecedents() {
    if (!this.caseDescription.trim()) return;
    
    this.loading = true;
    this.error = '';
    this.result = '';
    this.cdr.detectChanges();
    
    this.aiService.findPrecedents(this.caseDescription, this.practiceArea)
      .subscribe({
        next: (response) => {
          this.result = response.precedents;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.error || 'Precedent search failed';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  draftLegalMemo() {
    if (!this.memoTopic.trim()) return;
    
    this.loading = true;
    this.error = '';
    this.result = '';
    this.cdr.detectChanges();
    
    this.aiService.draftLegalMemo(this.memoTopic, this.jurisdiction, this.keyFacts)
      .subscribe({
        next: (response) => {
          this.result = response.memo;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = err.error?.error || 'Legal memo drafting failed';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  loadSampleStatute() {
    this.statuteText = `42 U.S.C. § 1983 - Civil Action for Deprivation of Rights

Every person who, under color of any statute, ordinance, regulation, custom, or usage, of any State or Territory or the District of Columbia, subjects, or causes to be subjected, any citizen of the United States or other person within the jurisdiction thereof to the deprivation of any rights, privileges, or immunities secured by the Constitution and laws, shall be liable to the party injured in an action at law, suit in equity, or other proper proceeding for redress, except that in any action brought against a judicial officer for an act or omission taken in such officer's judicial capacity, injunctive relief shall not be granted unless a declaratory decree was violated or declaratory relief was unavailable.`;
    
    this.result = '';
    this.error = '';
  }

  getTabLabel(): string {
    switch (this.activeTab) {
      case 'case-law': return 'Case Law Search';
      case 'statute': return 'Statute Interpretation';
      case 'precedents': return 'Precedent Analysis';
      case 'memo': return 'Legal Memorandum';
      default: return 'Research';
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
    a.download = `${this.getTabLabel()}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  clearResults() {
    this.result = '';
    this.error = '';
  }
}