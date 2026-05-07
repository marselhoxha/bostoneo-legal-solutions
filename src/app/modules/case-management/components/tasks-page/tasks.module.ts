import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DragDropModule } from '@angular/cdk/drag-drop';
import {
  LucideAngularModule,
  Search, Filter, Plus, MoreHorizontal, Check, Pencil, Trash2,
  UserPlus, X, ChevronDown, ChevronUp, Play, Pause, LayoutList, AlertCircle, Calendar,
  CalendarPlus, Clock, MessageCircle, Activity, ListChecks,
  ListTodo, Kanban, Gauge,
  User as LcUser,
} from 'lucide-angular';

import { TasksRoutingModule } from './tasks-routing.module';
import { TasksPageComponent } from './tasks-page.component';
import { TaskViewComponent } from './views/task-view/task-view.component';
import { PipelineViewComponent } from './views/pipeline-view/pipeline-view.component';
import { WorkloadViewComponent } from './views/workload-view/workload-view.component';
import { TaskDrawerComponent } from './task-drawer/task-drawer.component';
import { NewTaskModalComponent } from './new-task-modal/new-task-modal.component';
import { PriorityToTonePipe } from '@app/shared/pipes/priority-to-tone.pipe';
import { DueLabelPipe } from '@app/shared/pipes/due-label.pipe';
import { UserInitialsPipe } from '@app/shared/pipes/user-initials.pipe';
import { StatusToTonePipe } from '@app/shared/pipes/status-to-tone.pipe';
import { TasksStateService } from './tasks-state.service';

@NgModule({
  declarations: [
    TasksPageComponent,
    TaskViewComponent,
    PipelineViewComponent,
    WorkloadViewComponent,
    TaskDrawerComponent,
    NewTaskModalComponent,
    PriorityToTonePipe,
    DueLabelPipe,
    UserInitialsPipe,
    StatusToTonePipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TasksRoutingModule,
    DragDropModule,
    LucideAngularModule.pick({
      Search, Filter, Plus, MoreHorizontal, Check, Pencil, Trash2,
      UserPlus, X, ChevronDown, ChevronUp, Play, Pause, LayoutList, AlertCircle, Calendar,
      CalendarPlus, Clock, MessageCircle, Activity, ListChecks,
      ListTodo, Kanban, Gauge,
      User: LcUser,
    }),
  ],
  exports: [PriorityToTonePipe, DueLabelPipe, UserInitialsPipe, StatusToTonePipe],
  providers: [TasksStateService],
})
export class TasksModule {}
