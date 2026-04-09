import { Component, OnInit, OnDestroy, ChangeDetectorRef, SecurityContext, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StationeryService, StationeryTemplate } from '../../../services/stationery.service';
import { environment } from '../../../../../../environments/environment';
import { UserService } from '../../../../../service/user.service';

// ── Config types ───────────────────────────────────────────

export interface OfficeLocation {
  city: string;
  address?: string;
  phone?: string;
}

export type GridZone = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface ContactOverrides {
  firmName: string;
  firmAddress: string;
  firmPhone: string;
  firmEmail: string;
  firmWebsite: string;
}

export interface StationeryConfig {
  stationeryVersion: number;
  layout: {
    logoPosition: GridZone;
    contactPosition: GridZone;
  };
  letterhead: {
    logoBase64: string | null;
    logoMaxHeight: number;      // 40-120, default 70
    accentColor: string;
    showSeparator: boolean;
    contactFields: string[];
    faxNumber: string;
    contactOverrides: ContactOverrides;
  };
  signature: {
    closingText: string;
    showBarNumber: boolean;
    showLicenseState: boolean;
  };
  footer: {
    offices: OfficeLocation[];
  };
}

// ── Utility functions ──────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitizeColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#1a3a5c';
}

// ── Sample data for preview (built dynamically from logged-in user) ──

// ── Grid helpers ───────────────────────────────────────────

function getAlignment(zone: GridZone): string {
  if (zone.endsWith('-left')) return 'left';
  if (zone.endsWith('-center')) return 'center';
  return 'right';
}

function getRow(zone: GridZone): number {
  return zone.startsWith('top-') ? 0 : 1;
}

function getCol(zone: GridZone): number {
  if (zone.endsWith('-left')) return 0;
  if (zone.endsWith('-center')) return 1;
  return 2;
}

// ── Layout generator (grid-aware letterhead) ───────────────

/**
 * Grid-aware letterhead: logo and contact blocks placed into a 2-row × 3-column
 * virtual grid based on config.layout positions. Uses borderless tables for
 * CKEditor/export compatibility.
 */
function generateLetterhead(config: StationeryConfig): string {
  const c = config.letterhead;
  const color = sanitizeColor(c.accentColor);
  const logoPos = config.layout.logoPosition;
  const contactPos = config.layout.contactPosition;
  const ov = c.contactOverrides;

  // Use override values when provided, otherwise keep placeholders for backend resolution
  // Attorney-specific placeholders (direct_phone, fax, office_address) pull from Professional Details
  const firmName = ov.firmName?.trim() ? escapeHtml(ov.firmName.trim()) : '{{firm_name}}';
  const firmAddress = ov.firmAddress?.trim() ? escapeHtml(ov.firmAddress.trim()) : '{{office_address}}';
  const firmPhone = ov.firmPhone?.trim() ? escapeHtml(ov.firmPhone.trim()) : '{{direct_phone}}';
  const firmEmail = ov.firmEmail?.trim() ? escapeHtml(ov.firmEmail.trim()) : '{{firm_email}}';
  const firmWebsite = ov.firmWebsite?.trim() ? escapeHtml(ov.firmWebsite.trim()) : '{{firm_website}}';

  // Build logo HTML
  let logoHtml = '';
  if (c.logoBase64 && c.logoBase64.startsWith('data:image/')) {
    logoHtml = `<img src="${c.logoBase64}" alt="Logo" style="max-height:${c.logoMaxHeight}px;" />`;
  }

  // Build contact lines (stacked <p> tags) — matches professional legal letterhead format
  // Font matches document body: Times New Roman / Georgia serif, 12px, readable weight
  const cFont = "font-family:'Times New Roman',Georgia,serif;font-size:12px;";
  const contactLines: string[] = [];
  contactLines.push(`<p style="${cFont}font-weight:700;margin:0;">{{attorney_name}}</p>`);
  if (c.contactFields.includes('address')) contactLines.push(`<p style="${cFont}font-weight:500;margin:0;">${firmAddress}</p>`);
  if (c.contactFields.includes('phone')) contactLines.push(`<p style="${cFont}font-weight:500;margin:0;">p: ${firmPhone}</p>`);
  const faxValue = c.faxNumber?.trim() ? escapeHtml(c.faxNumber.trim()) : '{{fax}}';
  if (c.contactFields.includes('fax')) contactLines.push(`<p style="${cFont}font-weight:500;margin:0;">f: ${faxValue}</p>`);
  if (c.contactFields.includes('email')) contactLines.push(`<p style="${cFont}font-weight:500;margin:0;">${firmEmail}</p>`);
  if (c.contactFields.includes('website')) contactLines.push(`<p style="${cFont}font-weight:500;margin:0;">${firmWebsite}</p>`);
  const contactHtml = contactLines.join('\n');

  // Build centered contact (middot-separated single line)
  const centeredParts: string[] = ['{{attorney_name}}'];
  if (c.contactFields.includes('address')) centeredParts.push(firmAddress);
  if (c.contactFields.includes('phone')) centeredParts.push(firmPhone);
  if (c.contactFields.includes('fax')) centeredParts.push(faxValue);
  if (c.contactFields.includes('email')) centeredParts.push(firmEmail);
  if (c.contactFields.includes('website')) centeredParts.push(firmWebsite);
  const centeredContactHtml = `<p style="font-family:'Times New Roman',Georgia,serif;font-size:12px;font-weight:500;color:#333;margin:0;">${centeredParts.join(' &middot; ')}</p>`;

  // Optional firm name block (below logo, if logo exists, or as standalone text header)
  let firmNameHtml = '';
  if (ov.firmName?.trim()) {
    firmNameHtml = `<p style="font-size:14px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${color};margin:4px 0 0;">${firmName}</p>`;
  }

  // Combine logo image + firm name text into one cell content
  const logoCellContent = [logoHtml, firmNameHtml].filter(Boolean).join('\n');

  const logoRow = getRow(logoPos);
  const contactRow = getRow(contactPos);
  const logoCol = getCol(logoPos);
  const contactCol = getCol(contactPos);
  const logoAlign = getAlignment(logoPos);
  const contactAlign = getAlignment(contactPos);

  let headerHtml = '';

  // Case B: Both blocks in center column → stacked centered, no table
  if (logoCol === 1 && contactCol === 1) {
    const parts: string[] = [];
    // Top block first, bottom block second
    if (logoRow <= contactRow) {
      if (logoCellContent) parts.push(`<div style="text-align:center;margin:0;">${logoCellContent}</div>`);
      parts.push(`<div style="text-align:center;font-size:12px;line-height:1.5;color:#333;">${centeredContactHtml}</div>`);
    } else {
      parts.push(`<div style="text-align:center;font-size:12px;line-height:1.5;color:#333;">${centeredContactHtml}</div>`);
      if (logoCellContent) parts.push(`<div style="text-align:center;margin:0;">${logoCellContent}</div>`);
    }
    headerHtml = parts.join('\n');
  }
  // Case A: Both blocks in same row → 1-row, 3-column table
  else if (logoRow === contactRow) {
    const cells = ['', '', ''];
    cells[logoCol] = `<td style="vertical-align:top;text-align:${logoAlign};padding:0;border:none;">${logoCellContent}</td>`;
    cells[contactCol] = `<td style="vertical-align:top;text-align:${contactAlign};padding:0;font-family:'Times New Roman',Georgia,serif;font-size:12px;line-height:1.5;color:#333;border:none;">${contactHtml}</td>`;
    // Fill empty cell
    for (let i = 0; i < 3; i++) {
      if (!cells[i]) cells[i] = `<td style="padding:0;border:none;"></td>`;
    }
    headerHtml = `<table style="width:100%;border-collapse:collapse;border:none;">
<tbody>
<tr>
${cells.join('\n')}
</tr>
</tbody>
</table>`;
  }
  // Case C: Blocks in different rows → 2-row, 3-column table
  else {
    const row0 = ['', '', ''];
    const row1 = ['', '', ''];

    // Place logo in its row
    const logoRowCells = logoRow === 0 ? row0 : row1;
    logoRowCells[logoCol] = `<td style="vertical-align:top;text-align:${logoAlign};padding:0;border:none;">${logoCellContent}</td>`;

    // Place contact in its row
    const contactRowCells = contactRow === 0 ? row0 : row1;
    contactRowCells[contactCol] = `<td style="vertical-align:top;text-align:${contactAlign};padding:0;font-family:'Times New Roman',Georgia,serif;font-size:12px;line-height:1.5;color:#333;border:none;">${contactHtml}</td>`;

    // Fill empty cells
    for (const row of [row0, row1]) {
      for (let i = 0; i < 3; i++) {
        if (!row[i]) row[i] = `<td style="padding:0;border:none;"></td>`;
      }
    }

    headerHtml = `<table style="width:100%;border-collapse:collapse;border:none;">
<tbody>
<tr>
${row0.join('\n')}
</tr>
<tr>
${row1.join('\n')}
</tr>
</tbody>
</table>`;
  }

  // Append separator if enabled
  if (c.showSeparator) {
    headerHtml += `\n<div style="height:1px;background:${color};margin:6px 0 0;"></div>`;
  }

  return headerHtml;
}

function generateSignatureBlock(config: StationeryConfig): string {
  const s = config.signature;
  const closingText = escapeHtml(s.closingText || 'Sincerely,');
  const lines: string[] = [];

  lines.push(`<p style="font-size:12pt;margin:24px 0 16px 0;">${closingText}</p>`);
  lines.push(`<p style="font-size:10pt;color:rgba(0,0,0,0.35);margin:0;letter-spacing:0.5px;">_________________________</p>`);
  lines.push(`<p style="font-size:12pt;font-weight:600;margin:6px 0 0;">{{attorney_name}}</p>`);

  // Bar number + license state on one line
  const barParts: string[] = [];
  if (s.showBarNumber && s.showLicenseState) {
    barParts.push('{{license_state}} Bar No. {{bar_number}}');
  } else if (s.showBarNumber) {
    barParts.push('Bar No. {{bar_number}}');
  } else if (s.showLicenseState) {
    barParts.push('Licensed in {{license_state}}');
  }
  if (barParts.length > 0) {
    lines.push(`<p style="font-size:10pt;color:#666;margin:1px 0 0;">${barParts[0]}</p>`);
  }

  return lines.join('\n');
}

function generateFooterBlock(config: StationeryConfig): string {
  const offices = config.footer.offices.filter(o => o.city?.trim());
  const color = sanitizeColor(config.letterhead.accentColor);

  if (offices.length === 0) return '';

  const entries = offices.map(o => {
    const parts = [escapeHtml(o.city.trim())];
    if (o.address?.trim()) parts.push(escapeHtml(o.address.trim()));
    if (o.phone?.trim()) parts.push(escapeHtml(o.phone.trim()));
    return parts.join(' &middot; ');
  });

  return `<div style="border-top:1px solid ${color}22;padding-top:6px;margin-top:8px;">
<p style="text-align:center;font-size:9pt;color:#555;margin:0;line-height:1.5;">${entries.join(' &nbsp;|&nbsp; ')}</p>
</div>`;
}

export function generateLayoutHtml(config: StationeryConfig): { letterheadHtml: string; signatureHtml: string; footerHtml: string } {
  return {
    letterheadHtml: generateLetterhead(config),
    signatureHtml: generateSignatureBlock(config),
    footerHtml: generateFooterBlock(config)
  };
}

function replacePlaceholders(html: string, data: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

// ── Default config ─────────────────────────────────────────

function createDefaultConfig(): StationeryConfig {
  return {
    stationeryVersion: 2,
    layout: {
      logoPosition: 'top-left',
      contactPosition: 'top-right'
    },
    letterhead: {
      logoBase64: null,
      logoMaxHeight: 70,
      accentColor: '#1a3a5c',
      showSeparator: true,
      contactFields: ['address', 'phone', 'email'],
      faxNumber: '',
      contactOverrides: {
        firmName: '',
        firmAddress: '',
        firmPhone: '',
        firmEmail: '',
        firmWebsite: ''
      }
    },
    signature: {
      closingText: 'Sincerely,',
      showBarNumber: true,
      showLicenseState: true
    },
    footer: {
      offices: []
    }
  };
}

function deepMergeConfig(parsed: any): StationeryConfig {
  const defaults = createDefaultConfig();
  // Handle v1 configs (had layout as string, firmDisplayName, tagline)
  const layoutObj = (parsed.layout && typeof parsed.layout === 'object')
    ? { ...defaults.layout, ...parsed.layout }
    : defaults.layout;
  const lh = parsed.letterhead || {};
  return {
    ...defaults,
    ...parsed,
    layout: layoutObj,
    letterhead: {
      ...defaults.letterhead,
      ...lh,
      contactFields: Array.isArray(lh.contactFields) ? lh.contactFields : defaults.letterhead.contactFields,
      logoMaxHeight: typeof lh.logoMaxHeight === 'number'
        ? Math.max(40, Math.min(200, lh.logoMaxHeight))
        : defaults.letterhead.logoMaxHeight,
      contactOverrides: { ...defaults.letterhead.contactOverrides, ...(lh.contactOverrides || {}) }
    },
    signature: { ...defaults.signature, ...(parsed.signature || {}) },
    footer: { ...defaults.footer, ...(parsed.footer || {}) }
  };
}

// ── Component ──────────────────────────────────────────────

@Component({
  selector: 'app-stationery-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DragDropModule],
  templateUrl: './stationery-settings.component.html',
  styleUrls: ['./stationery-settings.component.scss']
})
export class StationerySettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private previewDebounce: ReturnType<typeof setTimeout> | null = null;

  templates: StationeryTemplate[] = [];
  selectedTemplate: StationeryTemplate | null = null;
  isNew = false;
  loading = false;
  saving = false;
  isLegacy = false;

  // Form fields
  templateName = '';
  isDefault = false;
  config: StationeryConfig = createDefaultConfig();

  // Preview (SafeHtml to preserve inline styles)
  previewLetterhead: SafeHtml = '';
  previewSignature: SafeHtml = '';
  previewFooter: SafeHtml = '';

  // Legacy template preview
  legacyLetterhead: SafeHtml = '';
  legacySignature: SafeHtml = '';
  legacyFooter: SafeHtml = '';

  // Logo size presets
  logoSizePresets = [
    { label: 'S', value: 50 },
    { label: 'M', value: 90 },
    { label: 'L', value: 150 }
  ];

  // Grid zones for template iteration
  gridZones: GridZone[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

  // Collapsible section toggles
  sectionOpen: Record<string, boolean> = {
    logo: true, layout: true, contact: true, appearance: false, signature: false, footer: true
  };

  contactFieldOptions = [
    { key: 'address', label: 'Address' },
    { key: 'phone', label: 'Phone' },
    { key: 'fax', label: 'Fax' },
    { key: 'email', label: 'Email' },
    { key: 'website', label: 'Website' }
  ];

  constructor(
    private stationeryService: StationeryService,
    private userService: UserService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  /** Build preview data from the logged-in user's profile */
  private buildPreviewData(): Record<string, string> {
    const user = this.userService.getCurrentUser();
    const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Your Name';
    return {
      '{{attorney_name}}': name || 'Your Name',
      '{{bar_number}}': '000000',
      '{{license_state}}': 'Your State',
      '{{firm_name}}': user?.organizationName || 'Your Firm Name',
      '{{firm_address}}': user?.address || 'Your Address',
      '{{firm_phone}}': user?.phone || '(000) 000-0000',
      '{{firm_email}}': user?.email || 'email@example.com',
      '{{firm_website}}': '',
      '{{firm_logo_url}}': '',
      '{{date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };
  }

  ngOnInit(): void {
    this.loadTemplates();
    // Re-render preview when user data arrives (handles page refresh timing)
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.selectedTemplate || this.isNew) {
        this.updatePreview();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.previewDebounce);
  }

  // ── Template list ────────────────────────────────

  loadTemplates(): void {
    this.loading = true;
    this.stationeryService.getTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          this.templates = templates;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  selectTemplate(template: StationeryTemplate): void {
    this.selectedTemplate = template;
    this.isNew = false;
    this.templateName = template.name || '';
    this.isDefault = template.isDefault || false;

    // Try to load config from formattingPreferences (deep merge)
    if (template.formattingPreferences) {
      try {
        const parsed = JSON.parse(template.formattingPreferences);
        if (parsed.stationeryVersion) {
          this.config = deepMergeConfig(parsed);
          this.isLegacy = false;
        } else {
          this.setLegacyMode(template);
        }
      } catch {
        this.setLegacyMode(template);
      }
    } else if (template.letterheadTemplate || template.signatureBlocks || template.footerTemplate) {
      this.setLegacyMode(template);
    } else {
      this.isLegacy = false;
      this.config = createDefaultConfig();
    }

    this.updatePreview();
    this.cdr.detectChanges();
  }

  private setLegacyMode(template: StationeryTemplate): void {
    this.isLegacy = true;
    this.config = createDefaultConfig();
    // Sanitize legacy HTML through Angular's built-in sanitizer (strips scripts/event handlers)
    // then trust the sanitized output for rendering with inline styles
    this.legacyLetterhead = this.sanitizer.bypassSecurityTrustHtml(
      this.sanitizer.sanitize(SecurityContext.HTML, template.letterheadTemplate || '') || ''
    );
    this.legacySignature = this.sanitizer.bypassSecurityTrustHtml(
      this.sanitizer.sanitize(SecurityContext.HTML, template.signatureBlocks || '') || ''
    );
    this.legacyFooter = this.sanitizer.bypassSecurityTrustHtml(
      this.sanitizer.sanitize(SecurityContext.HTML, template.footerTemplate || '') || ''
    );
  }

  newTemplate(): void {
    this.selectedTemplate = null;
    this.isNew = true;
    this.isLegacy = false;
    this.templateName = '';
    this.isDefault = false;
    this.config = createDefaultConfig();
    this.updatePreview();
    this.cdr.detectChanges();
  }

  recreateFromBuilder(): void {
    this.isLegacy = false;
    this.config = createDefaultConfig();
    this.updatePreview();
    this.cdr.detectChanges();
  }

  // ── Form helpers ─────────────────────────────────

  toggleSection(key: string): void {
    this.sectionOpen[key] = !this.sectionOpen[key];
  }

  isContactFieldSelected(field: string): boolean {
    return this.config.letterhead.contactFields.includes(field);
  }

  toggleContactField(field: string): void {
    const fields = this.config.letterhead.contactFields;
    const idx = fields.indexOf(field);
    if (idx >= 0) {
      fields.splice(idx, 1);
    } else {
      fields.push(field);
    }
    this.updatePreview();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      import('sweetalert2').then(Swal => {
        Swal.default.fire('Invalid File', 'Please upload an image file (PNG, JPEG, etc.).', 'warning');
      });
      return;
    }
    if (file.size > 2_000_000) {
      import('sweetalert2').then(Swal => {
        Swal.default.fire('File Too Large', 'Logo must be under 2MB. Please use a smaller image.', 'warning');
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.config.letterhead.logoBase64 = reader.result as string;
      this.updatePreview();
      this.cdr.detectChanges();
    };
    reader.onerror = () => {
      import('sweetalert2').then(Swal => {
        Swal.default.fire('Upload Failed', 'Could not read the file. Please try again.', 'error');
      });
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.config.letterhead.logoBase64 = null;
    this.updatePreview();
  }

  addOffice(): void {
    this.config.footer.offices.push({ city: '', address: '', phone: '' });
  }

  removeOffice(index: number): void {
    this.config.footer.offices.splice(index, 1);
    this.updatePreview();
  }

  // ── Preview ──────────────────────────────────────

  updatePreview(): void {
    const { letterheadHtml, signatureHtml, footerHtml } = generateLayoutHtml(this.config);
    // Override preview data with config values when present (so preview shows what you typed)
    const previewData = { ...this.buildPreviewData() };
    const ov = this.config.letterhead.contactOverrides;
    if (ov.firmName?.trim()) previewData['{{firm_name}}'] = ov.firmName.trim();
    if (ov.firmAddress?.trim()) previewData['{{firm_address}}'] = ov.firmAddress.trim();
    if (ov.firmPhone?.trim()) previewData['{{firm_phone}}'] = ov.firmPhone.trim();
    if (ov.firmEmail?.trim()) previewData['{{firm_email}}'] = ov.firmEmail.trim();
    if (ov.firmWebsite?.trim()) previewData['{{firm_website}}'] = ov.firmWebsite.trim();
    this.previewLetterhead = this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(replacePlaceholders(letterheadHtml, previewData)));
    this.previewSignature = this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(replacePlaceholders(signatureHtml, previewData)));
    this.previewFooter = this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(replacePlaceholders(footerHtml, previewData)));
  }

  onFormChange(): void {
    clearTimeout(this.previewDebounce);
    this.previewDebounce = setTimeout(() => this.updatePreview(), 150);
  }

  /** Pull attorney profile data into stationery contact fields */
  fillFromProfile(): void {
    this.http.get<any>(`${environment.apiUrl}/api/attorney-profile`).subscribe({
      next: (res: any) => {
        const a = res?.data?.attorney;
        if (!a || !a.id) {
          alert('No Professional Details found. Fill them in Settings > Professional first.');
          return;
        }
        if (a.firmName) this.config.letterhead.contactOverrides.firmName = a.firmName;
        if (a.officeStreet) {
          let addr = a.officeStreet;
          if (a.officeSuite) addr += ', ' + a.officeSuite;
          if (a.officeCity) addr += ', ' + a.officeCity;
          if (a.officeState) addr += ', ' + a.officeState;
          if (a.officeZip) addr += ' ' + a.officeZip;
          this.config.letterhead.contactOverrides.firmAddress = addr;
        }
        if (a.directPhone) this.config.letterhead.contactOverrides.firmPhone = a.directPhone;
        if (a.fax) this.config.letterhead.faxNumber = a.fax;
        this.onFormChange();
        this.cdr.markForCheck();
      },
      error: () => alert('Could not load Professional Details.')
    });
  }

  // ── Grid drag-drop helpers ─────────────────────────

  getBlockInZone(zone: GridZone): 'logo' | 'contact' | null {
    if (this.config.layout.logoPosition === zone) return 'logo';
    if (this.config.layout.contactPosition === zone) return 'contact';
    return null;
  }

  onBlockDropped(block: 'logo' | 'contact', zone: GridZone): void {
    // Don't allow both blocks in same zone
    if (block === 'logo' && this.config.layout.contactPosition === zone) return;
    if (block === 'contact' && this.config.layout.logoPosition === zone) return;

    if (block === 'logo') {
      this.config.layout.logoPosition = zone;
    } else {
      this.config.layout.contactPosition = zone;
    }
    this.updatePreview();
  }

  onGridDrop(event: CdkDragDrop<GridZone>): void {
    const block = event.item.data as 'logo' | 'contact';
    const targetZone = event.container.data as GridZone;
    this.onBlockDropped(block, targetZone);
  }

  setLogoSize(px: number): void {
    this.config.letterhead.logoMaxHeight = Math.max(40, Math.min(200, px));
    this.updatePreview();
  }

  // ── Save / Delete ────────────────────────────────

  saveTemplate(): void {
    if (!this.templateName.trim()) return;
    this.saving = true;

    const { letterheadHtml, signatureHtml, footerHtml } = generateLayoutHtml(this.config);

    const payload: StationeryTemplate = {
      id: this.isNew ? undefined : this.selectedTemplate?.id,
      name: this.templateName.trim(),
      letterheadTemplate: letterheadHtml,
      signatureBlocks: signatureHtml,
      footerTemplate: footerHtml,
      formattingPreferences: JSON.stringify(this.config),
      isDefault: this.isDefault
    };

    const request$ = this.isNew
      ? this.stationeryService.createTemplate(payload)
      : this.stationeryService.updateTemplate(payload.id!, payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (saved) => {
        this.saving = false;
        // Clear default badge from other templates if this one is now default
        if (saved.isDefault) {
          this.templates.forEach(t => { if (t.id !== saved.id) t.isDefault = false; });
        }
        if (this.isNew) {
          this.templates.push(saved);
          this.isNew = false;
        } else {
          const idx = this.templates.findIndex(t => t.id === saved.id);
          if (idx >= 0) this.templates[idx] = saved;
        }
        this.selectedTemplate = saved;
        this.isLegacy = false;

        import('sweetalert2').then(Swal => {
          Swal.default.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Template saved',
            showConfirmButton: false,
            timer: 2000
          });
        });

        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        import('sweetalert2').then(Swal => {
          Swal.default.fire('Error', 'Failed to save template. Please try again.', 'error');
        });
        this.cdr.detectChanges();
      }
    });
  }

  deleteTemplate(): void {
    if (!this.selectedTemplate?.id) return;
    const templateId = this.selectedTemplate.id;
    const templateName = this.selectedTemplate.name;

    import('sweetalert2').then(Swal => {
      Swal.default.fire({
        title: 'Delete Template?',
        text: `Are you sure you want to delete "${templateName}"? This cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        confirmButtonColor: '#f17171',
        customClass: {
          confirmButton: 'btn btn-sm btn-danger',
          cancelButton: 'btn btn-sm btn-light ms-2'
        },
        buttonsStyling: false
      }).then(result => {
        if (result.isConfirmed) {
          this.stationeryService.deleteTemplate(templateId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.templates = this.templates.filter(t => t.id !== templateId);
                this.selectedTemplate = null;
                this.isNew = false;
                this.cdr.detectChanges();
              },
              error: () => {
                Swal.default.fire('Error', 'Failed to delete template. Please try again.', 'error');
              }
            });
        }
      });
    });
  }

  cancelEdit(): void {
    if (this.isNew) {
      this.isNew = false;
      this.selectedTemplate = null;
    } else if (this.selectedTemplate) {
      this.selectTemplate(this.selectedTemplate);
    }
  }
}
