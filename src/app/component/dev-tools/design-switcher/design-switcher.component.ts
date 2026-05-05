import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from 'src/environments/environment';

type Design = 'velzon' | 'column' | 'rox';

const STORAGE_KEY = 'legience_design_preview';
const DESIGNS: Design[] = ['velzon', 'column', 'rox'];

@Component({
  selector: 'app-design-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './design-switcher.component.html',
  styleUrls: ['./design-switcher.component.scss']
})
export class DesignSwitcherComponent implements OnInit {
  // Rox is the production default. Velzon and Column survive as dev-only
  // toggles for migration testing. In production, the whole component is
  // hidden via *ngIf in app.component.html — this default only matters in
  // dev when localStorage is empty.
  current: Design = 'rox';
  designs = DESIGNS;
  collapsed = false;

  ngOnInit(): void {
    // Production never reads localStorage — Rox is forced. This prevents
    // a stale Velzon preference (saved during dev) from following a user
    // into production and showing the wrong design.
    if (environment.production) {
      this.apply('rox');
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY) as Design | null;
    if (saved && DESIGNS.includes(saved)) {
      this.current = saved;
    }
    this.apply(this.current);
  }

  apply(design: Design): void {
    this.current = design;
    document.documentElement.setAttribute('data-design', design);
    localStorage.setItem(STORAGE_KEY, design);
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
  }

  // Cmd/Ctrl + Shift + D cycles through designs
  @HostListener('window:keydown', ['$event'])
  handleShortcut(event: KeyboardEvent): void {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
      event.preventDefault();
      const idx = DESIGNS.indexOf(this.current);
      this.apply(DESIGNS[(idx + 1) % DESIGNS.length]);
    }
  }
}
