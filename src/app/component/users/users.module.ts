import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { UsersRoutingModule } from './users-routing.module';
import { UsersDirectoryComponent } from './users-directory/users-directory.component';
import { UserProfileModalComponent } from './user-profile-modal/user-profile-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbModule,
    UsersRoutingModule,
    UsersDirectoryComponent,
    UserProfileModalComponent
  ]
})
export class UsersModule { }