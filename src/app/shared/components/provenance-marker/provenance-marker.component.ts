import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProvenanceMap, ProvenanceSource } from 'src/app/modules/legal/services/provenance.service';

interface SourceVisual {
  cssClass: 'intake' | 'client' | 'ai' | 'manual';
  glyph: string;
  defaultLabel: string;
}

const VISUAL: Record<ProvenanceSource, SourceVisual> = {
  INTAKE_FORM:   { cssClass: 'intake', glyph: 'i', defaultLabel: 'from intake form' },
  CLIENT_PORTAL: { cssClass: 'client', glyph: 'c', defaultLabel: 'from client portal' },
  AI_EXTRACTED:  { cssClass: 'ai',     glyph: 'A', defaultLabel: 'AI-extracted' },
  MANUAL:        { cssClass: 'manual', glyph: 'm', defaultLabel: 'manually entered' },
};

/**
 * Renders the small {@code i / c / A / m} square chip next to a fact on the
 * PI case-detail UI. Backed by the {@code field_provenance} JSONB map on
 * {@code legal_cases} (V69) and read via {@link ProvenanceService}.
 *
 * <p>Usage:
 * <pre>
 *   &lt;app-provenance-marker [provenance]="caseProvenance" field="parties.plaintiff_dob"&gt;&lt;/app-provenance-marker&gt;
 * </pre>
 *
 * <p>Renders nothing if the field has no entry in the map — markers are
 * placed selectively on facts where provenance matters; missing-key cases
 * shouldn't add visual noise. An optional {@code [label]} override
 * customizes the tooltip text (e.g. "from police report" instead of the
 * generic "AI-extracted").
 */
@Component({
  selector: 'app-provenance-marker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <span *ngIf="visual as v" class="prov" [ngClass]="v.cssClass" [title]="label || v.defaultLabel">{{ v.glyph }}</span>
  `,
  styles: [`
    .prov {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 600;
      line-height: 1;
      color: #fff;
      margin-left: 6px;
      cursor: default;
      vertical-align: middle;
      flex-shrink: 0;
    }
    /* Velzon-token palette — matches the inline .prov markers baked into
       Case File mock data (pi-case-detail.component.scss line 6912) and
       auto-adapts to Bootstrap dark mode. The mockup hex codes were just
       one snapshot of the same intent. */
    .prov.intake { background: var(--vz-info); }
    .prov.client { background: var(--vz-success); }
    .prov.ai     { background: #6d28d9; } /* no Velzon purple token; same hex as the inline markers */
    .prov.manual { background: var(--vz-secondary-color); }
  `],
})
export class ProvenanceMarkerComponent {
  /** The full provenance map for the current case (parent owns the load). */
  @Input() provenance: ProvenanceMap | null | undefined;

  /** Dotted field path key (e.g. {@code "parties.plaintiff_dob"}). */
  @Input() field = '';

  /** Optional tooltip override; defaults to a generic label per source. */
  @Input() label?: string;

  get visual(): SourceVisual | null {
    const source = this.provenance?.[this.field];
    return source ? VISUAL[source] ?? null : null;
  }
}
