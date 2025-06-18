import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionDebuggerComponent } from './permission-debugger.component';

/**
 * Module for importing the PermissionDebuggerComponent
 * 
 * Note: PermissionDebuggerComponent is a standalone component and can be
 * imported directly in other components. This module is provided for
 * backwards compatibility with non-standalone components that need to
 * import it through a module.
 */
@NgModule({
  imports: [
    CommonModule,
    PermissionDebuggerComponent
  ],
  exports: [
    PermissionDebuggerComponent
  ]
})
export class PermissionDebuggerModule { } 