import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription } from 'rxjs';
import {
  CommandPaletteGroup,
  CommandPaletteResult,
  CommandPaletteService,
} from 'src/app/core/services/command-palette.service';

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './command-palette.component.html',
  styleUrls: ['./command-palette.component.scss'],
})
export class CommandPaletteComponent implements OnInit, OnDestroy {
  // The palette mounts at app shell level and is shown/hidden via the service's
  // BehaviorSubject. Local mirror so the template can render `*ngIf="isOpen"`
  // without an async pipe (we need synchronous reads inside keyboard handlers).
  isOpen = false;

  query = '';
  groupedResults: CommandPaletteGroup[] = [];
  flatResults: CommandPaletteResult[] = []; // flat list — simplifies arrow-key navigation
  selectedIndex = 0;

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  private sub?: Subscription;

  constructor(public palette: CommandPaletteService) {}

  ngOnInit(): void {
    this.sub = this.palette.isOpen$.subscribe(open => {
      this.isOpen = open;
      if (open) {
        // Reset state on each open. Recompute results so a stale empty-state
        // from a previous open doesn't show before the user types.
        this.query = '';
        this.recomputeResults();
        this.selectedIndex = 0;
        // Focus after Angular renders the input. Two rAFs is paranoid but
        // cheap — covers cases where the modal is opened during change-detection.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => this.searchInput?.nativeElement?.focus())
        );
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onQueryChange(): void {
    this.recomputeResults();
    // Keep selection at the top of fresh result lists; arrow keys can move it.
    this.selectedIndex = 0;
  }

  /** Recompute groupedResults + flatResults from the current query. */
  private recomputeResults(): void {
    this.groupedResults = this.palette.search(this.query);
    this.flatResults = this.groupedResults.flatMap(g => g.results);
  }

  // ── Mouse / click handlers ─────────────────────────────────────────
  // The component renders as a backdrop + centered dialog. The backdrop's
  // `(click)="close()"` closes; the dialog's `$event.stopPropagation()` keeps
  // clicks inside the dialog from bubbling to the backdrop.
  close(): void {
    this.palette.close();
  }

  onResultClick(result: CommandPaletteResult): void {
    this.palette.activate(result);
  }

  /** Mouse hover updates selection so the visual highlight tracks the cursor. */
  onResultHover(index: number): void {
    this.selectedIndex = index;
  }

  // ── Keyboard nav ───────────────────────────────────────────────────
  // HostListener catches keys anywhere in the document while the palette is
  // open — `(keydown)` on the input alone misses keys when focus drifts (e.g.
  // after click in scrollable area).
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.flatResults.length === 0) return;
      this.selectedIndex = (this.selectedIndex + 1) % this.flatResults.length;
      this.scrollSelectedIntoView();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.flatResults.length === 0) return;
      this.selectedIndex = (this.selectedIndex - 1 + this.flatResults.length) % this.flatResults.length;
      this.scrollSelectedIntoView();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const result = this.flatResults[this.selectedIndex];
      if (result) this.palette.activate(result);
      return;
    }
  }

  /** Keep the selected row visible when arrow-keying past the viewport edges. */
  private scrollSelectedIntoView(): void {
    requestAnimationFrame(() => {
      const el = document.querySelector(`.cmd-palette-result.selected`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}
