import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { AiDrawerService, AiDrawerState } from '../../../core/services/ai-drawer.service';

@Component({
  selector: 'app-ai-quick-drawer',
  templateUrl: './ai-quick-drawer.component.html',
  styleUrls: ['./ai-quick-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiQuickDrawerComponent implements OnInit, OnDestroy {
  state: AiDrawerState | null = null;
  private sub?: Subscription;

  constructor(
    private readonly drawer: AiDrawerService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.drawer.state$.subscribe(s => {
      this.state = s;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  close(): void {
    this.drawer.close();
  }
}
