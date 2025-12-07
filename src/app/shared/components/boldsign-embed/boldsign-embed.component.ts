import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, ChangeDetectorRef, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export type EmbedMode = 'send-document' | 'create-template' | 'edit-template' | 'send-from-template' | 'signing';
export type DisplayMode = 'iframe' | 'popup' | 'new-tab';

export interface BoldSignEvent {
  type: 'completed' | 'cancelled' | 'error' | 'saved' | 'sent';
  documentId?: string;
  templateId?: string;
  message?: string;
}

@Component({
  selector: 'app-boldsign-embed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="boldsign-embed-container"
         [class.loading]="loading"
         [class.fullscreen]="fullscreen"
         [class.iframe-mode]="displayMode === 'iframe'">

      <!-- Loading State -->
      <div class="loading-overlay" *ngIf="loading && !openedInExternalWindow">
        <div class="loading-content">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
          </div>
          <h5 class="loading-title">{{ getLoadingTitle() }}</h5>
          <p class="loading-text">{{ getLoadingMessage() }}</p>
          <div class="loading-progress" *ngIf="loadingProgress > 0">
            <div class="progress-bar" [style.width.%]="loadingProgress"></div>
          </div>
        </div>
      </div>

      <!-- Opened in External Window State -->
      <div class="external-window-state" *ngIf="openedInExternalWindow && !error">
        <div class="external-content">
          <div class="external-icon">
            <i class="ri-external-link-line"></i>
          </div>
          <h4>Document Opened in New Window</h4>
          <p>Complete your document in the opened window.<br>This page will update automatically when you're done.</p>
          <div class="external-actions">
            <button class="btn btn-primary" (click)="focusPopup()">
              <i class="ri-focus-3-line me-2"></i> Switch to Window
            </button>
            <button class="btn btn-outline-secondary ms-2" (click)="close()">
              <i class="ri-close-line me-2"></i> Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div class="error-state" *ngIf="error">
        <div class="error-content">
          <div class="error-icon">
            <i class="ri-error-warning-line"></i>
          </div>
          <h4>Unable to Load Document</h4>
          <p>{{ error }}</p>
          <div class="error-actions">
            <button class="btn btn-primary" (click)="retry()">
              <i class="ri-refresh-line me-2"></i> Try Again
            </button>
            <button class="btn btn-outline-secondary ms-2" (click)="close()">
              <i class="ri-arrow-left-line me-2"></i> Go Back
            </button>
          </div>
        </div>
      </div>

      <!-- BoldSign iFrame -->
      <iframe
        #boldSignFrame
        *ngIf="safeUrl && !error && !openedInExternalWindow"
        [src]="safeUrl"
        [class.visible]="!loading"
        (load)="onIframeLoad()"
        frameborder="0"
        allow="clipboard-write; clipboard-read"
        allowfullscreen>
      </iframe>

      <!-- Toolbar -->
      <div class="embed-toolbar" *ngIf="showCloseButton && !loading && !error && !openedInExternalWindow">
        <button class="btn btn-sm btn-light" (click)="toggleFullscreen()" *ngIf="displayMode === 'iframe'">
          <i [class]="fullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'"></i>
        </button>
        <button class="btn btn-sm btn-light ms-2" (click)="close()">
          <i class="ri-close-line"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .boldsign-embed-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 600px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-radius: 0.75rem;
      overflow: hidden;
    }

    .boldsign-embed-container.iframe-mode {
      background: #fff;
    }

    .boldsign-embed-container.fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1060;
      border-radius: 0;
      min-height: 100vh;
    }

    /* Loading State */
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      z-index: 10;
    }

    .loading-content {
      text-align: center;
      max-width: 320px;
    }

    .loading-spinner {
      position: relative;
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
    }

    .spinner-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border: 3px solid transparent;
      border-radius: 50%;
      animation: spin 1.5s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    }

    .spinner-ring:nth-child(1) {
      border-top-color: #405189;
      animation-delay: -0.45s;
    }

    .spinner-ring:nth-child(2) {
      width: 60px;
      height: 60px;
      top: 10px;
      left: 10px;
      border-top-color: #299cdb;
      animation-delay: -0.3s;
    }

    .spinner-ring:nth-child(3) {
      width: 40px;
      height: 40px;
      top: 20px;
      left: 20px;
      border-top-color: #0ab39c;
      animation-delay: -0.15s;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 0.5rem;
    }

    .loading-text {
      font-size: 0.875rem;
      color: #64748b;
      margin-bottom: 1rem;
    }

    .loading-progress {
      width: 100%;
      height: 4px;
      background-color: #e2e8f0;
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #405189, #299cdb);
      transition: width 0.3s ease;
    }

    /* Error State */
    .error-state {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }

    .error-content {
      text-align: center;
      max-width: 400px;
      padding: 2rem;
    }

    .error-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .error-icon i {
      font-size: 2.5rem;
      color: #ef4444;
    }

    .error-content h4 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 0.75rem;
    }

    .error-content p {
      font-size: 0.9375rem;
      color: #64748b;
      margin-bottom: 1.5rem;
    }

    /* External Window State */
    .external-window-state {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }

    .external-content {
      text-align: center;
      max-width: 400px;
      padding: 2rem;
    }

    .external-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .external-icon i {
      font-size: 2.5rem;
      color: #3b82f6;
    }

    .external-content h4 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 0.75rem;
    }

    .external-content p {
      font-size: 0.9375rem;
      color: #64748b;
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }

    /* iFrame */
    iframe {
      width: 100%;
      height: 100%;
      min-height: 600px;
      border: none;
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    iframe.visible {
      opacity: 1;
    }

    .fullscreen iframe {
      min-height: 100vh;
    }

    /* Toolbar */
    .embed-toolbar {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 20;
      display: flex;
      gap: 0.5rem;
    }

    .embed-toolbar .btn {
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border: none;
    }

    .embed-toolbar .btn:hover {
      background: #fff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .boldsign-embed-container {
        min-height: 500px;
      }

      iframe {
        min-height: 500px;
      }

      .loading-content,
      .error-content,
      .external-content {
        padding: 1.5rem;
      }
    }
  `]
})
export class BoldSignEmbedComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('boldSignFrame') frameRef!: ElementRef<HTMLIFrameElement>;

  @Input() url: string = '';
  @Input() mode: EmbedMode = 'send-document';
  @Input() displayMode: DisplayMode = 'iframe';
  @Input() showCloseButton: boolean = false;
  @Input() fullscreen: boolean = false;
  @Input() autoLoad: boolean = true;

  @Output() completed = new EventEmitter<BoldSignEvent>();
  @Output() cancelled = new EventEmitter<BoldSignEvent>();
  @Output() saved = new EventEmitter<BoldSignEvent>();
  @Output() sent = new EventEmitter<BoldSignEvent>();
  @Output() errorOccurred = new EventEmitter<BoldSignEvent>();
  @Output() closed = new EventEmitter<void>();
  @Output() loaded = new EventEmitter<void>();
  @Output() openedInWindow = new EventEmitter<Window>();

  safeUrl: SafeResourceUrl | null = null;
  loading: boolean = true;
  error: string | null = null;
  openedInExternalWindow: boolean = false;
  loadingProgress: number = 0;

  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private popupWindow: Window | null = null;
  private popupCheckInterval: any = null;
  private loadingInterval: any = null;

  constructor(
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    if (this.autoLoad && this.url) {
      this.loadUrl(this.url);
    }
  }

  ngAfterViewInit(): void {
    // Additional setup if needed after view init
  }

  ngOnDestroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }
    if (this.popupCheckInterval) {
      clearInterval(this.popupCheckInterval);
    }
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
    }
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
    }
  }

  getLoadingTitle(): string {
    switch (this.mode) {
      case 'send-document':
        return 'Preparing Your Document';
      case 'create-template':
        return 'Setting Up Template Editor';
      case 'edit-template':
        return 'Loading Template';
      case 'send-from-template':
        return 'Preparing Template';
      case 'signing':
        return 'Loading Signing Session';
      default:
        return 'Loading BoldSign';
    }
  }

  getLoadingMessage(): string {
    switch (this.mode) {
      case 'send-document':
        return 'Setting up signature fields and document preview...';
      case 'create-template':
        return 'Initializing template configuration...';
      case 'edit-template':
        return 'Loading template for editing...';
      case 'send-from-template':
        return 'Preparing document from template...';
      case 'signing':
        return 'Loading your document for signing...';
      default:
        return 'Please wait while we set things up...';
    }
  }

  /**
   * Load a URL - in iframe, popup, or new tab
   */
  loadUrl(url: string): void {
    this.loading = true;
    this.error = null;
    this.url = url;
    this.openedInExternalWindow = false;
    this.loadingProgress = 0;

    // Start loading progress animation
    this.startLoadingProgress();

    if (this.displayMode === 'popup') {
      this.openInPopup(url);
    } else if (this.displayMode === 'new-tab') {
      this.openInNewTab(url);
    } else {
      // iframe mode
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      this.cdr.detectChanges();
    }
  }

  /**
   * Start loading progress animation
   */
  private startLoadingProgress(): void {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
    }

    this.loadingProgress = 0;
    this.ngZone.runOutsideAngular(() => {
      this.loadingInterval = setInterval(() => {
        if (this.loadingProgress < 90) {
          // Gradually slow down progress
          const increment = Math.max(1, (90 - this.loadingProgress) / 10);
          this.ngZone.run(() => {
            this.loadingProgress = Math.min(90, this.loadingProgress + increment);
            this.cdr.detectChanges();
          });
        }
      }, 200);
    });
  }

  /**
   * Stop loading progress
   */
  private stopLoadingProgress(): void {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
    }
    this.loadingProgress = 100;
  }

  /**
   * Open URL in a popup window
   */
  openInPopup(url: string): void {
    const width = 1200;
    const height = 800;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    this.popupWindow = window.open(
      url,
      'BoldSign',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (this.popupWindow) {
      this.openedInExternalWindow = true;
      this.loading = false;
      this.stopLoadingProgress();
      this.cdr.detectChanges();
      this.openedInWindow.emit(this.popupWindow);

      // Monitor popup for close
      this.ngZone.runOutsideAngular(() => {
        this.popupCheckInterval = setInterval(() => {
          if (this.popupWindow?.closed) {
            clearInterval(this.popupCheckInterval);
            this.ngZone.run(() => {
              this.openedInExternalWindow = false;
              this.cancelled.emit({ type: 'cancelled', message: 'Window closed' });
              this.cdr.detectChanges();
            });
          }
        }, 500);
      });
    } else {
      this.error = 'Popup was blocked. Please allow popups for this site and try again.';
      this.loading = false;
      this.stopLoadingProgress();
      this.cdr.detectChanges();
    }
  }

  /**
   * Open URL in a new tab
   */
  openInNewTab(url: string): void {
    const newTab = window.open(url, '_blank');
    if (newTab) {
      this.openedInExternalWindow = true;
      this.loading = false;
      this.stopLoadingProgress();
      this.cdr.detectChanges();
      this.openedInWindow.emit(newTab);
    } else {
      this.error = 'Failed to open new tab. Please allow popups for this site.';
      this.loading = false;
      this.stopLoadingProgress();
      this.cdr.detectChanges();
    }
  }

  /**
   * Handle postMessage events from BoldSign
   */
  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent): void {
    // Only process messages from BoldSign domains
    // BoldSign uses app.boldsign.com and possibly other subdomains
    if (!event.origin.includes('boldsign.com')) {
      return;
    }

    console.log('[BoldSign] Received postMessage from:', event.origin, 'data:', event.data);

    try {
      let data: any;

      // Handle different data formats BoldSign might send
      if (typeof event.data === 'string') {
        // Try parsing as JSON
        try {
          data = JSON.parse(event.data);
        } catch {
          // If not valid JSON, check if it's an event name string
          data = { action: event.data };
        }
      } else if (typeof event.data === 'object' && event.data !== null) {
        data = event.data;
      } else {
        // Unknown format
        console.log('[BoldSign] Unknown data format:', typeof event.data, event.data);
        return;
      }

      this.handleBoldSignMessage(data);
    } catch (e) {
      console.error('[BoldSign] Error handling message:', e);
    }
  }

  /**
   * Handle BoldSign postMessage events
   * BoldSign event names (as per their API documentation):
   * - onCreateSuccess: Document/Template created successfully (document sent)
   * - onCreateFailed: Document/Template creation failed
   * - onDraftSuccess / onDraftSavedSuccess: Draft saved successfully
   * - onDraftFailed: Draft save failed
   * - onLoadComplete: Page finished loading
   * - onTemplateEditingCompleted: Template editing completed
   * - onTemplateEditingFailed: Template editing failed
   * - onPageNavigation: Page navigation event
   */
  private handleBoldSignMessage(data: any): void {
    const eventType = data.type || data.action || data.event || data.status;
    console.log('[BoldSign Event]', eventType, data);

    // Normalize event type for comparison (lowercase, trim)
    const normalizedEvent = eventType?.toLowerCase()?.trim();

    switch (normalizedEvent) {
      // === Load Events ===
      case 'onloadcomplete':
      case 'onload':
      case 'loaded':
        this.loading = false;
        this.stopLoadingProgress();
        this.loaded.emit();
        this.cdr.detectChanges();
        break;

      // === Document/Template Created Successfully ===
      // onCreateSuccess is used by BoldSign for BOTH document sending AND template creation
      // We differentiate based on the mode input
      case 'oncreatesuccess':
      case 'createsuccess':
      case 'onsent':
      case 'sent':
      case 'onsendcompleted':
      case 'sendcompleted':
      case 'onsendcomplete':
      case 'sendcomplete':
      case 'document_sent':
      case 'documentsent':
        this.loading = false;
        this.stopLoadingProgress();

        // Check mode to emit appropriate event
        if (this.mode === 'create-template' || this.mode === 'edit-template') {
          console.log('[BoldSign] Template created/updated successfully!');
          this.completed.emit({
            type: 'completed',
            templateId: data.templateId || data.template_id || data.id,
            message: data.message || 'Template saved successfully'
          });
        } else {
          // send-document or send-from-template mode
          console.log('[BoldSign] Document sent successfully!');
          this.sent.emit({
            type: 'sent',
            documentId: data.documentId || data.document_id || data.id,
            message: data.message || 'Document sent successfully'
          });
        }
        this.cdr.detectChanges();
        break;

      // === Template Editing Completed ===
      case 'ontemplateeditingcompleted':
      case 'templateeditingcompleted':
        console.log('[BoldSign] Template editing completed!');
        this.loading = false;
        this.stopLoadingProgress();
        this.completed.emit({
          type: 'completed',
          templateId: data.templateId || data.template_id || data.id,
          message: data.message
        });
        this.cdr.detectChanges();
        break;

      // === Signing Completed ===
      case 'oncomplete':
      case 'completed':
      case 'onsigned':
      case 'signed':
      case 'onsigncompleted':
      case 'signcompleted':
        console.log('[BoldSign] Signing completed!');
        this.loading = false;
        this.stopLoadingProgress();
        this.completed.emit({
          type: 'completed',
          documentId: data.documentId || data.document_id || data.id,
          message: data.message
        });
        this.cdr.detectChanges();
        break;

      // === Draft Saved ===
      case 'ondraftsuccess':
      case 'ondraftsavedsuccess':
      case 'draftsuccess':
      case 'draftsavedsuccess':
      case 'onsave':
      case 'saved':
      case 'ontemplatecreated':
      case 'templatecreated':
      case 'template_created':
        console.log('[BoldSign] Draft/Template saved successfully!');
        this.saved.emit({
          type: 'saved',
          documentId: data.documentId || data.document_id || data.id,
          templateId: data.templateId || data.template_id,
          message: data.message
        });
        this.cdr.detectChanges();
        break;

      // === Creation/Editing Failed ===
      case 'oncreatefailed':
      case 'createfailed':
      case 'ondraftfailed':
      case 'draftfailed':
      case 'ontemplateeditingfailed':
      case 'templateeditingfailed':
      case 'onerror':
      case 'error':
        console.error('[BoldSign] Error:', data.message || data);
        this.error = data.message || 'An error occurred while processing your document';
        this.loading = false;
        this.stopLoadingProgress();
        this.errorOccurred.emit({
          type: 'error',
          message: data.message
        });
        this.cdr.detectChanges();
        break;

      // === Cancelled ===
      case 'oncancel':
      case 'cancelled':
      case 'closed':
      case 'onclose':
        console.log('[BoldSign] Operation cancelled');
        this.cancelled.emit({
          type: 'cancelled',
          message: data.message
        });
        this.cdr.detectChanges();
        break;

      // === Page Navigation (informational, don't emit anything) ===
      case 'onpagenavigation':
      case 'pagenavigation':
        console.log('[BoldSign] Page navigation:', data.pageType, data.category);
        break;

      default:
        // Log unknown events for debugging
        if (eventType) {
          console.log('[BoldSign] Unhandled event type:', eventType, data);
        }
        break;
    }
  }

  /**
   * Called when iframe finishes loading
   */
  onIframeLoad(): void {
    // Give BoldSign a moment to initialize
    setTimeout(() => {
      this.loading = false;
      this.stopLoadingProgress();
      this.loaded.emit();
      this.cdr.detectChanges();
    }, 500);
  }

  /**
   * Retry loading
   */
  retry(): void {
    if (this.url) {
      this.loadUrl(this.url);
    }
  }

  /**
   * Close the embed
   */
  close(): void {
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
    }
    this.closed.emit();
  }

  /**
   * Focus the popup window
   */
  focusPopup(): void {
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.focus();
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen(): void {
    this.fullscreen = !this.fullscreen;
    this.cdr.detectChanges();
  }

  /**
   * Get the current iframe element
   */
  getIframe(): HTMLIFrameElement | null {
    return this.frameRef?.nativeElement || null;
  }
}
