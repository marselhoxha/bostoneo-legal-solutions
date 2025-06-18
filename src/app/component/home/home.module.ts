import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { StatsModule } from "../stats/stats.module";
import { HomeRoutingModule } from "./home-routing.module";
import { HomeComponent } from "./home/home.component";
import { LayoutsModule } from "../layouts/layouts.module";
import { NgChartsModule } from 'ng2-charts';
import { NgApexchartsModule } from 'ng-apexcharts';
import { FlatpickrModule } from 'angularx-flatpickr';
import { PermissionDebuggerComponent } from 'src/app/shared/components/permission-debugger/permission-debugger.component';

// Import dashboard components
import { AdminDashboardComponent } from '../dashboards/admin/admin-dashboard.component';
import { AttorneyDashboardComponent } from '../dashboards/attorney/attorney-dashboard.component';
import { ClientDashboardComponent } from '../dashboards/client/client-dashboard.component';
import { SecretaryDashboardComponent } from '../dashboards/secretary/secretary-dashboard.component';
import { ParalegalDashboardComponent } from '../dashboards/paralegal/paralegal-dashboard.component';
import { ManagerDashboardComponent } from '../dashboards/manager/manager-dashboard.component';

@NgModule({
  declarations: [
    HomeComponent,
    AdminDashboardComponent,
    AttorneyDashboardComponent,
    ClientDashboardComponent,
    SecretaryDashboardComponent,
    ParalegalDashboardComponent,
    ManagerDashboardComponent
  ],
  imports: [
    SharedModule, 
    HomeRoutingModule, 
    LayoutsModule,
    StatsModule,
    NgApexchartsModule, 
    NgChartsModule,
    FlatpickrModule.forRoot(),
    PermissionDebuggerComponent
  ],
})
export class HomeModule { }
