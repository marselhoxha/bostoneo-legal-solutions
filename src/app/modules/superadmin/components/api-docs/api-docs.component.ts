import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-api-docs',
  template: `
    <div class="container-fluid">
      <div class="d-flex align-items-center justify-content-between mb-3 mt-2">
        <div>
          <h5 class="mb-0 fw-semibold">
            <i class="ri-file-code-line me-2 text-primary"></i>API Documentation
          </h5>
          <small class="text-muted">Swagger UI — Interactive API reference</small>
        </div>
        <a [href]="rawUrl" target="_blank" class="btn btn-soft-primary btn-sm rounded-pill">
          <i class="ri-external-link-line me-1"></i> Open in New Tab
        </a>
      </div>
      <div class="card border-0 shadow-sm" style="height: calc(100vh - 180px); overflow: hidden;">
        <iframe [src]="swaggerUrl" class="w-100 h-100 border-0"></iframe>
      </div>
    </div>
  `
})
export class ApiDocsComponent {
  rawUrl: string;
  swaggerUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    this.rawUrl = `${environment.apiUrl}/swagger-ui/index.html`;
    this.swaggerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawUrl);
  }
}
