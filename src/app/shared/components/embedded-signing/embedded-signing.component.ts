import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SignatureService } from '../../../core/services/signature.service';

@Component({
  selector: 'app-embedded-signing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="embedded-signing-container">
      <!-- Loading State -->
      <div class="loading-overlay" *ngIf="loading">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading signing interface...</span>
        </div>
        <p class="mt-3 text-muted">Loading signing interface...</p>
      </div>

      <!-- Error State -->
      <div class="error-container" *ngIf="error">
        <div class="text-center py-5">
          <div class="avatar-lg mx-auto mb-3">
            <div class="avatar-title bg-danger-subtle text-danger rounded-circle fs-24">
              <i class="ri-error-warning-line"></i>
            </div>
          </div>
          <h5 class="text-danger">Unable to Load Signing Interface</h5>
          <p class="text-muted">{{ error }}</p>
          <button class="btn btn-primary" (click)="loadSigningUrl()">
            <i class="ri-refresh-line me-1"></i> Try Again
          </button>
          <button class="btn btn-light ms-2" (click)="close()">
            Close
          </button>
        </div>
      </div>

      <!-- Signing iFrame -->
      <div class="iframe-container" *ngIf="signingUrl && !loading && !error">
        <div class="iframe-header">
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <h6 class="mb-0">{{ title }}</h6>
              <small class="text-muted">Please review and sign the document below</small>
            </div>
            <button class="btn btn-sm btn-soft-secondary" (click)="close()">
              <i class="ri-close-line me-1"></i> Close
            </button>
          </div>
        </div>
        <iframe
          [src]="signingUrl"
          class="signing-iframe"
          frameborder="0"
          allowfullscreen
          (load)="onIframeLoad()">
        </iframe>
      </div>
    </div>
  `,
  styles: [`
    .embedded-signing-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 600px;
      background: var(--vz-body-bg);
      border-radius: 0.5rem;
      overflow: hidden;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--vz-body-bg);
      z-index: 10;
    }

    .error-container {
      padding: 2rem;
    }

    .iframe-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .iframe-header {
      padding: 1rem;
      background: var(--vz-light);
      border-bottom: 1px solid var(--vz-border-color);
    }

    .signing-iframe {
      flex: 1;
      width: 100%;
      min-height: 550px;
      border: none;
    }

    .avatar-lg {
      height: 4rem;
      width: 4rem;
    }

    .avatar-title {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
    }

    .fs-24 {
      font-size: 1.5rem;
    }
  `]
})
export class EmbeddedSigningComponent implements OnInit, OnDestroy {
  @Input() requestId!: number;
  @Input() signerEmail!: string;
  @Input() title: string = 'Sign Document';

  @Output() signed = new EventEmitter<void>();
  @Output() declined = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  signingUrl: SafeResourceUrl | null = null;
  loading = false;
  error: string | null = null;

  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(
    private signatureService: SignatureService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadSigningUrl();
    this.setupMessageListener();
  }

  ngOnDestroy(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
    }
  }

  loadSigningUrl(): void {
    this.loading = true;
    this.error = null;

    this.signatureService.getEmbeddedSigningUrl(this.requestId, this.signerEmail).subscribe({
      next: (response) => {
        const url = response.data?.signingUrl;
        if (url) {
          this.signingUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        } else {
          this.error = 'No signing URL received';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error getting signing URL:', err);
        this.error = err.error?.message || 'Failed to load signing interface';
        this.loading = false;
      }
    });
  }

  onIframeLoad(): void {
    // iFrame has loaded
  }

  private setupMessageListener(): void {
    // Listen for messages from BoldSign iframe
    this.messageListener = (event: MessageEvent) => {
      // Validate origin (BoldSign domain)
      if (!event.origin.includes('boldsign.com')) {
        return;
      }

      const data = event.data;

      if (typeof data === 'object') {
        switch (data.type || data.action) {
          case 'onSigningComplete':
          case 'signed':
            this.signed.emit();
            break;
          case 'onDeclined':
          case 'declined':
            this.declined.emit();
            break;
          case 'onClose':
          case 'close':
            this.closed.emit();
            break;
        }
      }
    };

    window.addEventListener('message', this.messageListener);
  }

  close(): void {
    this.closed.emit();
  }
}
