import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { ToastrModule } from 'ngx-toastr';

export @NgModule({
  imports: [
    CommonModule,
    BrowserAnimationsModule, // required animations module
    ToastrModule.forRoot(
        {
            timeOut: 4000,
            positionClass: 'toast-bottom-right',
            preventDuplicates: true,
          }
    ), // ToastrModule added
  ],
    exports: [ToastrModule]
})
class ToastrNotificationModule {}