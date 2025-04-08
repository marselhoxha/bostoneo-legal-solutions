import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { StatsModule } from "../stats/stats.module";
import { HomeRoutingModule } from "./home-routing.module";
import { HomeComponent } from "./home/home.component";
import { LayoutsModule } from "../layouts/layouts.module";
import { InvoiceAnalyticsModule } from "../invoice-analytics/invoice-analytics.module";
import { InvoiceAnalyticsComponent } from "../invoice-analytics/invoice-analytics.component";
import { NgChartsModule } from 'ng2-charts';
import { NgApexchartsModule } from 'ng-apexcharts';
import { FlatpickrModule } from 'angularx-flatpickr';



@NgModule({
  declarations: [HomeComponent],
  imports: [
    SharedModule, 
    HomeRoutingModule, 
    LayoutsModule,
     StatsModule,
     NgApexchartsModule, 
     NgChartsModule,
     FlatpickrModule.forRoot()],
  
})
export class HomeModule { }
