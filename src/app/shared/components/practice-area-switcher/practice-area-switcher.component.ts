import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PracticeAreaContextService } from 'src/app/core/services/practice-area-context.service';
import { labelFor } from 'src/app/shared/constants/practice-area-options';

/**
 * Practice-area switcher pill — replaces the org-name slot in the topbar.
 *
 * Three render modes driven by `practiceAreas$.length`:
 *   - 0  → renders nothing (e.g. attorney with no practice areas attached
 *          yet, or non-attorney users like superadmin/clients).
 *   - 1  → static pill (icon + name, no chevron, no dropdown).
 *   - 2+ → interactive pill with chevron, click opens a dropdown listing
 *          all available practice areas.
 *
 * State lives in PracticeAreaContextService (root singleton) so the topbar
 * pill and the attorney-dashboard outlet stay in sync.
 */
@Component({
  selector: 'app-practice-area-switcher',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './practice-area-switcher.component.html',
  styleUrls: ['./practice-area-switcher.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticeAreaSwitcherComponent implements OnInit, OnDestroy {

  practiceAreas: string[] = [];
  activeTab: string | null = null;
  isOpen = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly context: PracticeAreaContextService,
    private readonly host: ElementRef<HTMLElement>,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    combineLatest([this.context.practiceAreas$, this.context.activeTab$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([areas, active]) => {
        this.practiceAreas = areas;
        this.activeTab = active;
        // If the active tab disappears (e.g. org disables an area), close
        // any stale dropdown.
        if (areas.length < 2) this.isOpen = false;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Map a practice-area enum value to a sensible lucide icon name. */
  iconFor(area: string | null | undefined): string {
    switch (area) {
      case 'PERSONAL_INJURY':       return 'heart-pulse';
      case 'FAMILY_LAW':            return 'users';
      case 'CRIMINAL_DEFENSE':      return 'gavel';
      case 'IMMIGRATION':           return 'globe';
      case 'CIVIL_LITIGATION':      return 'scale';
      case 'BUSINESS_LAW':          return 'briefcase';
      case 'REAL_ESTATE':           return 'home';
      case 'INTELLECTUAL_PROPERTY': return 'lightbulb';
      case 'ESTATE_PLANNING':       return 'scroll-text';
      case 'BANKRUPTCY':            return 'wallet';
      case 'TAX_LAW':               return 'receipt';
      case 'EMPLOYMENT_LAW':        return 'hard-hat';
      case 'CONTRACT_LAW':          return 'file-text';
      case 'ENVIRONMENTAL_LAW':     return 'leaf';
      case 'CLASS_ACTION':          return 'users-round';
      default:                       return 'folder';
    }
  }

  labelFor(area: string | null | undefined): string {
    return labelFor(area ?? '');
  }

  togglePill(): void {
    if (this.practiceAreas.length < 2) return;
    this.isOpen = !this.isOpen;
  }

  selectArea(area: string): void {
    this.context.setActiveTab(area);
    this.isOpen = false;
  }

  /** Close on outside click. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    const target = event.target as Node;
    if (!this.host.nativeElement.contains(target)) {
      this.isOpen = false;
      this.cdr.markForCheck();
    }
  }

  /** Close on Esc when dropdown is open. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.cdr.markForCheck();
    }
  }
}
