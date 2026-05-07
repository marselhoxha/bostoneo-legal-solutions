import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TasksStateService } from './tasks-state.service';

type TasksView = 'inbox' | 'pipeline' | 'workload';

@Component({
  selector: 'app-tasks-page',
  templateUrl: './tasks-page.component.html',
  styleUrls: ['./tasks-page.component.scss'],
})
export class TasksPageComponent implements OnInit, OnDestroy {
  activeView: TasksView = 'inbox';
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private state: TasksStateService,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(p => {
      const v = p.get('view') as TasksView | null;
      this.activeView = (v === 'pipeline' || v === 'workload') ? v : 'inbox';

      // Sync URL → state for the modal selection (one-way). Row clicks set
      // state directly for instant render; this catches deep-links + back/
      // forward navigation only.
      const tid = p.get('task');
      const id = tid ? +tid : null;
      if (id !== this.state.selectedId) {
        this.state.select(id);
      }

      // Same one-way sync for the "+ New task" modal: deep-link / back-forward
      // updates the state flag the modal subscribes to. Mid-session opens use
      // state.setNewTaskOpen(true) directly via openNewTaskModal().
      const newTaskParam = p.get('new');
      const wantNewTaskOpen = newTaskParam === 'task';
      if (wantNewTaskOpen !== this.state.newTaskOpen) {
        this.state.setNewTaskOpen(wantNewTaskOpen);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  switchView(view: TasksView): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Open the "+ New task" modal via the same `?new=task` query-param
   * contract the inbox view's empty-state CTA uses. Mutually exclusive
   * with the drawer (`?task=:id`).
   *
   * Sets state synchronously so the modal renders immediately; URL bar
   * updates via History API (no Angular Router NavigationStart, no
   * global preloader).
   */
  openNewTaskModal(): void {
    // Close the drawer first so the two centered overlays don't stack/fight
    // for z-index. Both drawer and modal sit at --legience-z-modal, so DOM
    // order would otherwise determine which is on top.
    this.state.select(null);
    this.state.setNewTaskOpen(true);

    const queryParams = { ...this.route.snapshot.queryParams, new: 'task' };
    delete queryParams['task'];
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams,
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }
}
