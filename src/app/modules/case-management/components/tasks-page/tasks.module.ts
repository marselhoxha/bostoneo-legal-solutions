import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TasksRoutingModule } from './tasks-routing.module';
import { TasksPageComponent } from './tasks-page.component';
import { InboxViewComponent } from './views/inbox-view/inbox-view.component';
import { PriorityToTonePipe } from '@app/shared/pipes/priority-to-tone.pipe';
import { DueLabelPipe } from '@app/shared/pipes/due-label.pipe';
import { UserInitialsPipe } from '@app/shared/pipes/user-initials.pipe';

@NgModule({
  declarations: [
    TasksPageComponent,
    InboxViewComponent,
    PriorityToTonePipe,
    DueLabelPipe,
    UserInitialsPipe,
  ],
  imports: [CommonModule, RouterModule, TasksRoutingModule],
  exports: [PriorityToTonePipe, DueLabelPipe, UserInitialsPipe],
})
export class TasksModule {}
