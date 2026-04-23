import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { DocumentEditorComponent } from '../../ai-workspace/document-editor/document-editor.component';
import { TemplateService, Template } from '../../../../services/template.service';
import { PRACTICE_AREAS, JURISDICTIONS } from '../../../../shared/legal-constants';

interface DocCategory { readonly code: string; readonly name: string; }
interface DetectedVariable { readonly name: string; readonly count: number; }

const DOC_CATEGORIES: ReadonlyArray<DocCategory> = [
  { code: 'MOTION',              name: 'Motion' },
  { code: 'BRIEF',               name: 'Brief' },
  { code: 'CONTRACT',            name: 'Contract' },
  { code: 'CORRESPONDENCE',      name: 'Correspondence / Letter' },
  { code: 'IMMIGRATION_FORM',    name: 'Immigration Form' },
  { code: 'FAMILY_LAW_FORM',     name: 'Family Law Form' },
  { code: 'CRIMINAL_MOTION',     name: 'Criminal Motion' },
  { code: 'REAL_ESTATE_DOC',     name: 'Real Estate Document' },
  { code: 'PATENT_APPLICATION',  name: 'Patent Application' },
  { code: 'OTHER',               name: 'Other' }
];

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DocumentEditorComponent],
  templateUrl: './template-editor.component.html',
  styleUrls: ['./template-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateEditorComponent implements OnInit {
  readonly categories = DOC_CATEGORIES;
  readonly practiceAreas = PRACTICE_AREAS;
  readonly jurisdictions = JURISDICTIONS;

  templateId: number | null = null;
  loading = false;

  name = '';
  description = '';
  category = '';
  practiceArea = '';
  jurisdiction = '';
  documentType = '';
  shareWithOrg = true;

  editorContent = '';
  // Separate buffer: accumulates user edits on every keystroke but is NOT
  // bound to <app-document-editor>'s [content] input. Re-binding the input
  // on each keystroke makes the CKEditor wrapper call setData(), which
  // rebuilds the document and resets the caret to position 0.
  private pendingContent = '';
  detectedVariables: DetectedVariable[] = [];

  saving = false;
  dirty = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private templateService: TemplateService,
    private cdr: ChangeDetectorRef
  ) {}

  get isEditMode(): boolean {
    return this.templateId !== null;
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;

    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      this.handleLoadError('Invalid template ID.');
      return;
    }

    this.templateId = id;
    this.loadTemplate(id);
  }

  private loadTemplate(id: number): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.templateService.getTemplate(id).subscribe({
      next: (template) => {
        this.name = template.name ?? '';
        this.description = template.description ?? '';
        this.category = template.category ?? '';
        this.practiceArea = template.practiceArea ?? '';
        this.jurisdiction = template.jurisdiction ?? '';
        this.documentType = template.documentType ?? '';
        this.shareWithOrg = !template.isPrivate;
        this.editorContent = template.templateContent ?? '';
        this.pendingContent = this.editorContent;
        this.computeDetectedVariables(this.editorContent);
        setTimeout(() => {
          this.loading = false;
          this.dirty = false;
          this.cdr.markForCheck();
        }, 100);
      },
      error: (err) => this.handleLoadError(err?.error?.message || err?.message || 'Template could not be loaded.')
    });
  }

  private handleLoadError(message: string): void {
    this.loading = false;
    this.cdr.markForCheck();
    Swal.fire({
      icon: 'error',
      title: 'Unable to open template',
      text: message,
      confirmButtonColor: '#405189'
    }).then(() => this.router.navigate(['/legal/ai-assistant/templates']));
  }

  onEditorContentChange(html: string): void {
    // Write to the buffer, NOT to `editorContent`. Re-binding [content] would
    // round-trip through CKEditor's reactive [data] input and reset the caret.
    this.pendingContent = html;
    if (!this.loading) {
      this.dirty = true;
    }
    this.computeDetectedVariables(html);
    this.cdr.markForCheck();
  }

  private computeDetectedVariables(html: string): void {
    const re = /\{\{([a-z_][a-z0-9_]*)\}\}/gi;
    const counts = new Map<string, number>();
    for (const m of html.matchAll(re)) {
      const core = m[1].toLowerCase();
      counts.set(core, (counts.get(core) || 0) + 1);
    }
    this.detectedVariables = Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }

  async save(): Promise<void> {
    const trimmedName = this.name.trim();
    if (!trimmedName) {
      Swal.fire({ icon: 'warning', title: 'Template name is required', confirmButtonColor: '#405189' });
      return;
    }
    if (!this.category) {
      Swal.fire({ icon: 'warning', title: 'Please select a category', confirmButtonColor: '#405189' });
      return;
    }
    if (!this.pendingContent || !this.pendingContent.replace(/<[^>]*>/g, '').trim()) {
      Swal.fire({ icon: 'warning', title: 'Template body is empty', confirmButtonColor: '#405189' });
      return;
    }

    const payload: Template = {
      name: trimmedName,
      description: this.description.trim() || undefined,
      category: this.category,
      practiceArea: this.practiceArea || undefined,
      jurisdiction: this.jurisdiction || undefined,
      documentType: this.documentType.trim() || undefined,
      templateContent: this.pendingContent,
      templateType: 'HTML',
      isPrivate: !this.shareWithOrg
    };

    this.saving = true;
    this.cdr.markForCheck();

    const request$ = this.isEditMode
      ? this.templateService.updateTemplate(this.templateId!, payload)
      : this.templateService.createTemplate(payload);

    const successMsg = this.isEditMode ? 'Template updated' : 'Template saved';
    const successText = this.isEditMode
      ? `"${trimmedName}" has been updated.`
      : `"${trimmedName}" is now available in the library.`;

    request$.subscribe({
      next: () => {
        this.dirty = false;
        Swal.fire({
          icon: 'success',
          title: successMsg,
          text: successText,
          confirmButtonColor: '#405189',
          timer: 1800,
          showConfirmButton: false
        });
        this.router.navigate(['/legal/ai-assistant/templates']);
      },
      error: (err) => {
        this.saving = false;
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'error',
          title: this.isEditMode ? 'Failed to update template' : 'Failed to save template',
          text: err?.error?.message || err?.message || 'Please try again.',
          confirmButtonColor: '#405189'
        });
      }
    });
  }

  async cancel(): Promise<void> {
    if (!this.dirty) {
      this.router.navigate(['/legal/ai-assistant/templates']);
      return;
    }
    const res = await Swal.fire({
      icon: 'warning',
      title: this.isEditMode ? 'Discard changes?' : 'Discard this template?',
      text: 'Your unsaved changes will be lost.',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#74788d',
      confirmButtonText: 'Discard',
      cancelButtonText: 'Keep editing'
    });
    if (res.isConfirmed) {
      this.router.navigate(['/legal/ai-assistant/templates']);
    }
  }
}
