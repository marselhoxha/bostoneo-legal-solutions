import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// --------------------------- DTOs ---------------------------
// Shape mirrors backend DTOs in com.bostoneo.bostoneosolutions.dto.ai.*
// Sprint 1.5 template-import feature.

export type FileStatus =
  | 'QUEUED'
  | 'EXTRACTING'
  | 'ANALYZING'
  | 'READY'
  | 'ERROR'
  | 'DUPLICATE';

export interface ImportWarning {
  severity: 'INFO' | 'WARNING' | 'ERROR';
  code: string;
  message: string;
}

export interface DetectedVariable {
  rawText: string;
  suggestedKey: string;
  suggestedLabel: string;
  dataType: string;
  confidence: number;
  occurrences: number;
  isPreExistingPlaceholder: boolean;
}

export interface Classification {
  documentType?: string;
  practiceArea?: string;
  jurisdiction?: string;
  confidence?: number;
  evidence?: string;
  category?: string;
}

export interface TemplateAnalysisResult {
  classification?: Classification;
  detectedVariables?: DetectedVariable[];
  warnings?: ImportWarning[];
  suggestedName?: string;
  suggestedDescription?: string;
  suggestedBodyWithPlaceholders?: string;
  requiresManualClassification?: boolean;
}

export interface ImportFileStatus {
  fileId: string;
  filename: string;
  status: FileStatus;
  errorCode?: string;
  errorMessage?: string;
  contentHash?: string;
  duplicateOfTemplateId?: number;
  duplicateOfTemplateName?: string;
  analysis?: TemplateAnalysisResult;

  // Sprint 1.6 — tells the wizard which preview path to take.
  // true  → GET /preview returns the tokenized DOCX/PDF bytes for 1:1 rendering.
  // false → fall back to the <pre> text dump of suggestedBodyWithPlaceholders (scanned PDF / legacy .doc / PDF flag off).
  hasBinaryTemplate?: boolean;
  binaryFormat?: 'DOCX' | 'PDF';
}

export type PreviewVariant = 'original' | 'transformed';

export interface RetokenizeRequest {
  rejectedVariableKeys?: string[];
  variableRenames?: { [oldKey: string]: string };
}

export interface ImportSessionResponse {
  sessionId: string;
  createdAt?: string;
  expiresAt?: string;
  files: ImportFileStatus[];
  allFinalized: boolean;
}

export interface AnalyzeResponse {
  sessionId: string;
  files: Array<{ fileId: string; filename: string; size: number }>;
}

export interface ImportFileDecision {
  fileId: string;
  action: 'IMPORT' | 'SKIP' | 'OVERWRITE';
  templateName?: string;
  templateDescription?: string;
  category?: string;
  practiceArea?: string;
  jurisdiction?: string;
  isPrivate?: boolean;
  variableRenames?: { [oldKey: string]: string };
  rejectedVariableKeys?: string[];
  overwriteTemplateId?: number;
}

export interface ImportCommitRequest {
  decisions: ImportFileDecision[];
}

export interface ImportCommitResponse {
  importBatchId: string;
  created: number;
  skipped: number;
  overwritten: number;
  failed: number;
  createdTemplateIds?: number[];
  failures?: string[];
}

@Injectable({ providedIn: 'root' })
export class TemplateImportService {
  private readonly apiUrl = `${environment.apiUrl}/api/ai/templates/import`;

  constructor(private http: HttpClient) {}

  /** POST /analyze — multipart upload, returns session id + file ids. */
  analyze(files: File[]): Observable<AnalyzeResponse> {
    const form = new FormData();
    files.forEach(f => form.append('files', f, f.name));
    // NOTE: do NOT set Content-Type — browser adds multipart boundary.
    return this.http.post<AnalyzeResponse>(`${this.apiUrl}/analyze`, form, {
      withCredentials: true
    });
  }

  /**
   * GET /session/{id} — polled every ~2s by the wizard.
   *
   * The unique `_t` query param makes every poll a distinct URL so no URL-keyed cache
   * (service worker, browser HTTP cache, proxy) can short-circuit. NO custom request
   * headers: adding `Cache-Control`/`Pragma`/`Expires` request headers triggers a CORS
   * preflight that the backend allow-list doesn't whitelist, aborting the real GET.
   * Prior symptom: frontend fired 65 polls, backend saw only 1, wizard froze on EXTRACTING.
   */
  getSession(sessionId: string): Observable<ImportSessionResponse> {
    const params = new HttpParams().set('_t', Date.now().toString());
    return this.http.get<ImportSessionResponse>(
      `${this.apiUrl}/session/${sessionId}`,
      { withCredentials: true, params }
    );
  }

  /**
   * POST /session/{id}/reanalyze — attorney tweaked classification, re-run Claude Haiku.
   * Must re-upload the file since raw bytes aren't persisted between polls.
   */
  reanalyze(sessionId: string, fileId: string, file: File): Observable<{ fileId: string; status: string }> {
    const form = new FormData();
    form.append('fileId', fileId);
    form.append('file', file, file.name);
    return this.http.post<{ fileId: string; status: string }>(
      `${this.apiUrl}/session/${sessionId}/reanalyze`,
      form,
      { withCredentials: true }
    );
  }

  /** POST /session/{id}/commit — attorney's final decisions, persists templates. */
  commit(sessionId: string, request: ImportCommitRequest): Observable<ImportCommitResponse> {
    return this.http.post<ImportCommitResponse>(
      `${this.apiUrl}/session/${sessionId}/commit`,
      request,
      { withCredentials: true }
    );
  }

  /**
   * GET /session/{sid}/files/{fid}/preview — streams the cached binary bytes for the wizard's preview pane.
   *
   * Defaults to `transformed` (the tokenized copy the attorney is reviewing). Pass `original` to show a
   * side-by-side of the pristine upload. Cache-buster `_t` param is identical to the session poll:
   * keeps browser/proxy caches honest without triggering a CORS preflight (no custom request headers).
   */
  getFilePreview(
    sessionId: string,
    fileId: string,
    variant: PreviewVariant = 'transformed'
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('variant', variant)
      .set('_t', Date.now().toString());
    return this.http.get(
      `${this.apiUrl}/session/${sessionId}/files/${fileId}/preview`,
      { withCredentials: true, params, responseType: 'blob' }
    );
  }

  /**
   * POST /session/{sid}/files/{fid}/retokenize — re-runs the binary transform after the attorney rejects a
   * variable or renames a key. The cached `transformedBytes` is replaced in place; callers must re-invoke
   * {@link getFilePreview} to observe the refreshed preview. Returns 204 on success.
   */
  retokenize(
    sessionId: string,
    fileId: string,
    request: RetokenizeRequest
  ): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/session/${sessionId}/files/${fileId}/retokenize`,
      request ?? {},
      { withCredentials: true }
    );
  }
}
