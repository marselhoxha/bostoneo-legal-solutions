import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ExtractArrayValue } from "../pipes/extractvalue.pipe";
import { PreloaderComponent } from "../component/preloader/preloader.component";
import { SafePipe } from './pipes/safe.pipe';
import { CountUpDirective } from './directives/count-up.directive';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmationDialogModule } from './components/confirmation-dialog/confirmation-dialog.module';
import { VirtualListComponent } from './components/virtual-list/virtual-list.component';
import { VirtualTableComponent } from './components/virtual-table/virtual-table.component';
import { AvailabilitySettingsComponent } from './components/availability-settings/availability-settings.component';
import { ImageUrlPipe } from '../pipes/image-url.pipe';

/**
 * Note about standalone components:
 * ConfirmationDialogComponent and PermissionDebuggerComponent are standalone components.
 * Standalone components should be imported directly where they are used,
 * not through the SharedModule. 
 * 
 * Usage example:
 * import { PermissionDebuggerComponent } from './shared/components/permission-debugger/permission-debugger.component';
 * 
 * @Component({
 *   standalone: true,
 *   imports: [
 *     PermissionDebuggerComponent,
 *     // other imports
 *   ],
 *   // ...
 * })
 * or for non-standalone components:
 * 
 * @NgModule({
 *   imports: [
 *     PermissionDebuggerComponent,
 *     // other imports
 *   ],
 *   // ...
 * })
 */

@NgModule({
  declarations: [
    ExtractArrayValue,
    SafePipe,
    CountUpDirective,
    VirtualListComponent,
    VirtualTableComponent,
    AvailabilitySettingsComponent
  ],
  imports: [
    RouterModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ScrollingModule,
    MatDialogModule,
    MatButtonModule,
    ConfirmationDialogModule,
    ImageUrlPipe
  ],
  exports: [
    RouterModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ScrollingModule,
    ExtractArrayValue,
    SafePipe,
    CountUpDirective,
    VirtualListComponent,
    VirtualTableComponent,
    AvailabilitySettingsComponent,
    MatDialogModule,
    MatButtonModule,
    ImageUrlPipe
  ]
})
export class SharedModule { }
