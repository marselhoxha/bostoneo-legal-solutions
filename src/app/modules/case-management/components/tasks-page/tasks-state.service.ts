import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { CaseTask } from '@app/interface/case-task';

/**
 * In-memory cache of the currently-loaded task list, shared between the
 * inbox view and the drawer/modal. Lets the drawer render instantly on row
 * click instead of waiting for a network roundtrip.
 *
 * Scope: tasks-page only. Provided in TasksModule (not root) so it gets a
 * fresh cache each time the page is mounted.
 */
@Injectable()
export class TasksStateService {
  private cache = new Map<number, CaseTask>();
  private tasksSubject = new BehaviorSubject<CaseTask[]>([]);
  private insertedSubject = new Subject<CaseTask>();
  private selectedIdSubject = new BehaviorSubject<number | null>(null);

  /** Latest tasks list as an Observable. */
  readonly tasks$: Observable<CaseTask[]> = this.tasksSubject.asObservable();

  /**
   * Stream of newly-created tasks. Inbox view subscribes to this so a task
   * created by the "+ New task" modal lands in the list without a refetch.
   * Distinct from `tasks$` (which fires on every drawer-fetch upsert).
   */
  readonly inserted$: Observable<CaseTask> = this.insertedSubject.asObservable();

  /**
   * Currently-selected task ID (for the drawer/modal). Set synchronously by
   * the row click handler so the modal renders without waiting for the
   * router URL update (which can take ~1s due to navigation overhead).
   * URL state is kept in sync separately for deep-link persistence.
   */
  readonly selectedId$: Observable<number | null> = this.selectedIdSubject.asObservable();

  /** Selects a task synchronously (drawer reads from cache + this). */
  select(id: number | null): void {
    this.selectedIdSubject.next(id);
  }

  /** Current selection (sync read). */
  get selectedId(): number | null {
    return this.selectedIdSubject.value;
  }

  // ── "+ New task" modal open state ───────────────────────────────────────
  // Same pattern as selectedId$ — set sync by tasks-page so the modal
  // renders without a router roundtrip (which would trigger the global
  // preloader on NavigationStart).
  private newTaskOpenSubject = new BehaviorSubject<boolean>(false);

  /** "+ New task" modal open state as an Observable (modal subscribes). */
  readonly newTaskOpen$: Observable<boolean> = this.newTaskOpenSubject.asObservable();

  /** Set the "+ New task" modal open/closed sync. */
  setNewTaskOpen(open: boolean): void {
    this.newTaskOpenSubject.next(open);
  }

  /** Current open state (sync read — used by the URL→state guard in tasks-page). */
  get newTaskOpen(): boolean {
    return this.newTaskOpenSubject.value;
  }

  /**
   * True when the cache holds any tasks (sync read). Views check this on mount
   * to decide between rendering immediately from cache (warm) vs showing a
   * skeleton while waiting on a cold fetch. Without this, every tab switch
   * destroys/recreates a view that re-flashes its skeleton over data the
   * cache could have served instantly.
   */
  get hasCachedTasks(): boolean {
    return this.cache.size > 0;
  }

  /** Replace the entire cache with a fresh list (called by the inbox view after fetch). */
  setAll(tasks: CaseTask[]): void {
    this.cache.clear();
    for (const t of tasks) {
      if (t?.id != null) this.cache.set(t.id, t);
    }
    this.tasksSubject.next(tasks);
  }

  /** Synchronous lookup. Returns null if not in cache. */
  get(id: number): CaseTask | null {
    return this.cache.get(id) ?? null;
  }

  /**
   * Update or insert a single task (e.g., after a background full-fetch
   * that returned comments + subtasks the list endpoint doesn't include).
   */
  upsert(task: CaseTask | null | undefined): void {
    if (!task || task.id == null) return;
    this.cache.set(task.id, task);
    this.tasksSubject.next(Array.from(this.cache.values()));
  }

  /**
   * Insert a brand-new task (created via the "+ New task" modal) and emit
   * a dedicated event the inbox subscribes to so it can prepend the row
   * without a full refetch.
   */
  insert(task: CaseTask | null | undefined): void {
    if (!task || task.id == null) return;
    this.cache.set(task.id, task);
    this.tasksSubject.next(Array.from(this.cache.values()));
    this.insertedSubject.next(task);
  }

  /** Remove a task from the cache (e.g., after a hard-delete). */
  remove(id: number): void {
    if (id == null) return;
    this.cache.delete(id);
    this.tasksSubject.next(Array.from(this.cache.values()));
  }
}
