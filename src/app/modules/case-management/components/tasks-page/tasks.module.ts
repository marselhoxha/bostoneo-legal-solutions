import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TasksRoutingModule } from './tasks-routing.module';
import { TasksPageComponent } from './tasks-page.component';

@NgModule({
  declarations: [TasksPageComponent],
  imports: [CommonModule, RouterModule, TasksRoutingModule],
})
export class TasksModule {}
