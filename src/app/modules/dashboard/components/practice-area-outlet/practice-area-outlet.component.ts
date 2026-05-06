import {
  Component,
  ComponentRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
  signal,
} from '@angular/core';
import { PRACTICE_AREA_MODULES } from '../../practice-area-modules';

/**
 * Lazy module loader for the active practice-area top-level component.
 *
 * - Looks up the active practice area in `PRACTICE_AREA_MODULES`.
 * - If found, lazy-imports the module and instantiates the entry component.
 * - If NOT found (Phase 4 reality: nothing is registered), renders
 *   <app-practice-area-coming-soon>.
 * - Surfaces loading and error states with a Retry affordance.
 */
@Component({
  selector: 'app-practice-area-outlet',
  templateUrl: './practice-area-outlet.component.html',
  styleUrls: ['./practice-area-outlet.component.scss'],
})
export class PracticeAreaOutletComponent implements OnChanges {
  @Input() activePracticeArea: string | null = null;
  @ViewChild('container', { read: ViewContainerRef, static: true })
  container!: ViewContainerRef;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notRegistered = signal(false);
  private currentRef: ComponentRef<any> | null = null;

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (!changes['activePracticeArea']) return;
    await this.loadActiveModule();
  }

  private async loadActiveModule(): Promise<void> {
    this.error.set(null);
    this.notRegistered.set(false);
    this.container.clear();
    this.currentRef = null;

    if (!this.activePracticeArea) {
      this.notRegistered.set(true);
      return;
    }

    const loader = PRACTICE_AREA_MODULES[this.activePracticeArea];
    if (!loader) {
      this.notRegistered.set(true);
      return;
    }

    this.loading.set(true);
    try {
      const componentType = await loader();
      this.currentRef = this.container.createComponent(componentType);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load practice area');
    } finally {
      this.loading.set(false);
    }
  }

  retry(): void {
    void this.loadActiveModule();
  }
}
