import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { DocumentAnalyzerService, DocumentAnalysisResult, AnalysisHistory } from '../../services/document-analyzer.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-document-analyzer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-analyzer.component.html',
  styleUrls: ['./document-analyzer.component.scss']
})
export class DocumentAnalyzerComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;

  private destroy$ = new Subject<void>();

  // UI State
  isAnalyzing = false;
  isDragging = false;
  activeTab = 'upload'; // 'upload' | 'history' | 'results'

  // Selected options
  selectedAnalysisType = 'general';
  selectedFile: File | null = null;

  // Progress tracking
  uploadProgress = 0;
  analysisStatus = 'idle'; // idle, uploading, analyzing, completed, failed

  // Analysis results
  currentAnalysis: DocumentAnalysisResult | null = null;
  analysisHistory: AnalysisHistory[] = [];

  // Statistics
  stats = {
    totalAnalyzed: 0,
    timeSaved: 0,
    accuracy: 95,
    riskIssues: 0,
    todayAnalyses: 0,
    weeklyTrend: '+12%'
  };

  // Analysis types
  analysisTypes = [
    {
      value: 'contract',
      label: 'Contract Analysis',
      icon: 'ri-file-text-line',
      description: 'Review contracts and agreements for risks and obligations',
      color: 'primary'
    },
    {
      value: 'legal-brief',
      label: 'Legal Brief Review',
      icon: 'ri-file-paper-line',
      description: 'Analyze legal briefs and court filings',
      color: 'info'
    },
    {
      value: 'compliance',
      label: 'Compliance Check',
      icon: 'ri-shield-check-line',
      description: 'Ensure regulatory and legal compliance',
      color: 'success'
    },
    {
      value: 'due-diligence',
      label: 'Due Diligence',
      icon: 'ri-search-eye-line',
      description: 'Comprehensive examination for transactions',
      color: 'warning'
    },
    {
      value: 'risk-assessment',
      label: 'Risk Assessment',
      icon: 'ri-alert-line',
      description: 'Identify and evaluate potential risks',
      color: 'danger'
    },
    {
      value: 'general',
      label: 'General Analysis',
      icon: 'ri-file-search-line',
      description: 'Comprehensive document review',
      color: 'secondary'
    }
  ];

  // Sample documents
  sampleDocuments = [
    {
      name: 'Service Agreement Template',
      type: 'contract',
      size: '24 KB'
    },
    {
      name: 'Motion to Dismiss',
      type: 'legal-brief',
      size: '18 KB'
    },
    {
      name: 'GDPR Compliance Checklist',
      type: 'compliance',
      size: '15 KB'
    }
  ];

  constructor(
    private documentAnalyzerService: DocumentAnalyzerService
  ) {}

  ngOnInit(): void {
    this.loadAnalysisHistory();
    this.loadStatistics();
    this.subscribeToAnalysisStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToAnalysisStatus(): void {
    this.documentAnalyzerService.analysisStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.analysisStatus = status;
        this.isAnalyzing = status === 'uploading' || status === 'analyzing';
      });

    this.documentAnalyzerService.uploadProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.uploadProgress = progress.percentage;
      });
  }

  private loadAnalysisHistory(): void {
    this.documentAnalyzerService.getAnalysisHistory()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => {
          this.analysisHistory = history;
          this.stats.totalAnalyzed = history.length;
        },
        error: (error) => {
          console.error('Failed to load analysis history:', error);
        }
      });
  }

  private loadStatistics(): void {
    // TODO: Load real statistics from backend
    this.stats = {
      totalAnalyzed: this.analysisHistory.length,
      timeSaved: Math.round(this.analysisHistory.length * 2.5),
      accuracy: 95,
      riskIssues: this.analysisHistory.filter(a => a.riskLevel === 'High').length,
      todayAnalyses: 5,
      weeklyTrend: '+12%'
    };
  }

  // File handling methods
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  private handleFile(file: File): void {
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf'
    ];

    if (!validTypes.includes(file.type)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid File Type',
        text: 'Please upload a PDF, Word document, or text file.',
        confirmButtonColor: '#6691e7'
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      Swal.fire({
        icon: 'error',
        title: 'File Too Large',
        text: 'Please upload a file smaller than 10MB.',
        confirmButtonColor: '#6691e7'
      });
      return;
    }

    this.selectedFile = file;
  }

  analyzeDocument(): void {
    if (!this.selectedFile) {
      Swal.fire({
        icon: 'warning',
        title: 'No File Selected',
        text: 'Please select a document to analyze.',
        confirmButtonColor: '#6691e7'
      });
      return;
    }

    this.isAnalyzing = true;
    this.activeTab = 'results';

    this.documentAnalyzerService.analyzeDocument(this.selectedFile, this.selectedAnalysisType)
      .pipe(
        takeUntil(this.destroy$),
        filter(result => result !== null)
      )
      .subscribe({
        next: (result) => {
          this.currentAnalysis = result;
          this.isAnalyzing = false;
          this.loadAnalysisHistory(); // Refresh history

          if (result.status === 'completed') {
            Swal.fire({
              icon: 'success',
              title: 'Analysis Complete',
              text: 'Your document has been successfully analyzed.',
              confirmButtonColor: '#6691e7'
            });
          }
        },
        error: (error) => {
          this.isAnalyzing = false;
          console.error('Analysis failed:', error);

          Swal.fire({
            icon: 'error',
            title: 'Analysis Failed',
            text: error.error?.error || 'Failed to analyze the document. Please try again.',
            confirmButtonColor: '#6691e7'
          });
        }
      });
  }

  loadSampleDocument(doc: any): void {
    // TODO: Load actual sample document
    Swal.fire({
      icon: 'info',
      title: 'Sample Document',
      text: `Loading ${doc.name} for analysis...`,
      timer: 2000,
      showConfirmButton: false
    });
  }

  viewAnalysis(analysis: AnalysisHistory): void {
    this.documentAnalyzerService.getAnalysisById(analysis.analysisId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.currentAnalysis = result;
          this.activeTab = 'results';
        },
        error: (error) => {
          console.error('Failed to load analysis:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load analysis details.',
            confirmButtonColor: '#6691e7'
          });
        }
      });
  }

  downloadReport(): void {
    if (!this.currentAnalysis) return;

    this.documentAnalyzerService.downloadAnalysisReport(this.currentAnalysis.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `analysis-report-${this.currentAnalysis!.id}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Failed to download report:', error);
          Swal.fire({
            icon: 'error',
            title: 'Download Failed',
            text: 'Failed to download the analysis report.',
            confirmButtonColor: '#6691e7'
          });
        }
      });
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Copied!',
        text: 'Analysis copied to clipboard.',
        timer: 1500,
        showConfirmButton: false
      });
    });
  }

  resetAnalysis(): void {
    this.selectedFile = null;
    this.currentAnalysis = null;
    this.uploadProgress = 0;
    this.activeTab = 'upload';
    this.documentAnalyzerService.resetAnalysisState();

    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'ri-file-pdf-line text-danger';
      case 'doc':
      case 'docx':
        return 'ri-file-word-line text-primary';
      case 'txt':
        return 'ri-file-text-line text-info';
      default:
        return 'ri-file-line text-secondary';
    }
  }

  getRiskBadgeClass(riskLevel: string | undefined): string {
    return this.documentAnalyzerService.getRiskLevelClass(riskLevel);
  }

  getStatusBadgeClass(status: string): string {
    return this.documentAnalyzerService.getStatusClass(status);
  }

  formatFileSize(bytes: number): string {
    return this.documentAnalyzerService.formatFileSize(bytes);
  }

  getCurrentDate(): Date {
    return new Date();
  }
}