import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebsiteRoutingModule } from './website-routing.module';
import { WebsiteLayoutComponent } from './layout/website-layout.component';
import { WebsiteNavbarComponent } from './components/navbar/website-navbar.component';
import { WebsiteFooterComponent } from './components/footer/website-footer.component';

@NgModule({
  imports: [
    CommonModule,
    WebsiteRoutingModule,
    WebsiteLayoutComponent,
    WebsiteNavbarComponent,
    WebsiteFooterComponent
  ]
})
export class WebsiteModule { }
