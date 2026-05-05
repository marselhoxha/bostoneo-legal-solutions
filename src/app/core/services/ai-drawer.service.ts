import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActiveCaseContext } from './active-case-context.service';

export interface AiDrawerState {
  context?: { activeCase?: ActiveCaseContext | null };
  openedAt: number;
}

/**
 * Triggers and tracks the Ask Legience side-panel drawer. The topbar's
 * "Ask Legience" button calls `open(context)` with the current active
 * case so the drawer can preload context. The actual drawer component
 * (`<app-ai-quick-drawer>`) subscribes to `state$` and slides in/out.
 */
@Injectable({ providedIn: 'root' })
export class AiDrawerService {
  private readonly subject = new BehaviorSubject<AiDrawerState | null>(null);
  readonly state$: Observable<AiDrawerState | null> = this.subject.asObservable();

  open(context?: AiDrawerState['context']): void {
    this.subject.next({ context, openedAt: Date.now() });
  }

  close(): void {
    this.subject.next(null);
  }

  toggle(context?: AiDrawerState['context']): void {
    if (this.subject.value) this.close();
    else this.open(context);
  }
}
