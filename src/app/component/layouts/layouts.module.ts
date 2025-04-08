import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { SimplebarAngularModule } from 'simplebar-angular';

// Component pages
import { SharedModule } from 'src/app/shared/shared.module';
import { FooterComponent } from './footer/footer.component';
import { HorizontalTopbarComponent } from './horizontal-topbar/horizontal-topbar.component';
import { HorizontalComponent } from './horizontal/horizontal.component';
import { LayoutComponent } from './layout.component';
import { TopbarComponent } from './topbar/topbar.component';



@NgModule({
  declarations: [
    LayoutComponent,
    
    TopbarComponent,
  
    FooterComponent,
    HorizontalComponent,
    HorizontalTopbarComponent,
   

  ],
  imports: [
   
    SharedModule,
    
    NgbDropdownModule,
    SimplebarAngularModule,
    FormsModule, 
    ReactiveFormsModule
  ],
  exports: [
    LayoutComponent
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
 
})
export class LayoutsModule { }
