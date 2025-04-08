import { HttpEvent, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, map, startWith, catchError, of, combineLatest } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, Page } from 'src/app/interface/appstates';
import { Customer } from 'src/app/interface/customer';
import { State } from 'src/app/interface/state';
import { Stats } from 'src/app/interface/stats';
import { User } from 'src/app/interface/user';
import { CustomerService } from 'src/app/service/customer.service';
import { saveAs } from 'file-saver';
import { InvoiceAnalyticsService } from 'src/app/service/invoice-analytics.service';
import { circle, latLng, tileLayer } from 'leaflet';
import { ApexLegend, ApexYAxis, ChartComponent } from 'ng-apexcharts';
import { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexGrid, ApexStroke, ApexFill, ApexMarkers, ApexTooltip } from 'ng-apexcharts';
import Odometer from 'odometer';

import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  PolarAreaController,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
} from 'chart.js';

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  PointElement,
  LineElement,
  BarController,
  DoughnutController,
  ArcElement,
  PolarAreaController,
  RadialLinearScale,
  PieController,
  RadarController
);
export type ChartOptions = {
  series: ApexAxisChartSeries; 
  chart: ApexChart; 
  xaxis: ApexXAxis;
  yaxis?: ApexYAxis | ApexYAxis[]; // This can now handle multiple Y axes
  stroke: ApexStroke; 
  fill: ApexFill;
  markers: ApexMarkers;
  tooltip: ApexTooltip;
  grid: ApexGrid; 
  legend: ApexLegend; 
};

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {

  @ViewChild("chart") chart: ChartComponent;
  public OverviewChart: Partial<ChartOptions>;

  totalCustomers = 0;
  totalInvoices = 0;
  totalBilled = 0;

  odometerCustomers: any;
  odometerInvoices: any;
  odometerBilled: any;
  combinedState$: Observable<{
    homeState: State<CustomHttpResponse<Page<Customer> & User & Stats>>;
    newCustomerState: State<CustomHttpResponse<Page<Customer> & User & Stats>>;
  }>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Page<Customer> & User & Stats>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  private currentPageSubject = new BehaviorSubject<number>(0);
  currentPage$ = this.currentPageSubject.asObservable();
  private showLogsSubject = new BehaviorSubject<boolean>(false);
  showLogs$ = this.showLogsSubject.asObservable();
  private fileStatusSubject = new BehaviorSubject<{ status: string, type: string, percent: number }>(undefined);
  fileStatus$ = this.fileStatusSubject.asObservable();
  readonly DataState = DataState;
  homeState$: Observable<{ dataState: DataState; appData: CustomHttpResponse<Page<Customer> & User & Stats>; } | { dataState: DataState; } | { dataState: DataState; error: string; }>;
  newCustomerState$: any;
  private paidVsUnpaidSubject = new BehaviorSubject<{ paidInvoices: number, unpaidInvoices: number }>({ paidInvoices: 0, unpaidInvoices: 0 });
  paidVsUnpaid$ = this.paidVsUnpaidSubject.asObservable(); // Observable for paid vs unpaid invoices
   // Chart instance for Line Area Chart
   lineAreaChart: any;
   // Donut Chart
   donutChart: any;
  constructor(private router: Router, private customerService: CustomerService,
     private analyticsService: InvoiceAnalyticsService,private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {

    setTimeout(() => {
      // Update odometers
      this.odometerCustomers.update(this.totalCustomers);
      this.odometerInvoices.update(this.totalInvoices);
      this.odometerBilled.update(this.totalBilled);
    }, 1000); // Simulate a delay
    // Observable for home state
    this.homeState$ = this.customerService.customers$()
      .pipe(
        map(response => {
          const data = response.data as any;
          const stats = data.stats;  
          if (stats) {
            this.totalCustomers = stats.totalCustomers;
            this.totalInvoices = stats.totalInvoices;
            this.totalBilled = stats.totalBilled;
          }
          this._OverviewChart('["--vz-primary", "--vz-success", "--vz-warning"]');
          this.cdr.detectChanges();
          this.dataSubject.next(response);
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, error });
        })
      );
      
    // Load the data for the chart
    this.loadAnalyticsData();

    
  }

  ngAfterViewInit(): void {
    // Initialize odometers after the view is rendered
    this.odometerCustomers = new Odometer({
      el: document.querySelector('.odometer-customers'),
      value: 0
    });

    this.odometerInvoices = new Odometer({
      el: document.querySelector('.odometer-invoices'),
      value: 0
    });

    this.odometerBilled = new Odometer({
      el: document.querySelector('.odometer-billed'),
      value: 0
    });
  }

  private _OverviewChart(colors: any) {
    colors = this.getChartColorsArray(colors);
    this.OverviewChart = {
      series: [{
        name: 'Total Customers',
        type: 'bar',
        data: [100, 200, 150, 120, 250, 300, 280, 350, 290, 330, 360, 400]
      }, {
        name: 'Total Billed',
        type: 'area',
        data: [120, 330, 225, 240, 335, 445, 250, 355, 360, 465, 470, 575]
      }, {
        name: 'Total Invoices',
        type: 'bar',
        data: [50, 60, 55, 70, 65, 75, 80, 85, 90, 95, 100, 105]
      }],
      chart: {
        height: 374,
        type: 'line',
        toolbar: {
          show: false,
        }
      },
      stroke: {
        curve: 'smooth',
        dashArray: [0, 3, 0],
        width: [0, 1, 0],
      },
      fill: {
        opacity: [1, 0.1, 1]
      },
      markers: {
        size: [0, 4, 0], 
        strokeWidth: 2,
        hover: {
          size: 4, 
        }
      },
      xaxis: {
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        axisTicks: {
          show: true
        },
        axisBorder: {
          show: true
        }
      },
      // Use an array for multiple Y-axes
      yaxis: [
        {
          title: {
            text: 'Total Customers', 
            style: {
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#263238'
            }
          },
          min: 0,
          max: 400,
          tickAmount: 4,
          decimalsInFloat: 0
        },
        {
          opposite: true,
          title: {
            text: 'Total Billed', 
            style: {
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#263238'
            }
          },
          min: 10000,
          max: 20000,
          tickAmount: 4,
          decimalsInFloat: 0
        },
        {
          title: {
            text: 'Total Invoices', 
            style: {
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#263238'
            }
          },
          min: 0,
          max: 200,
          tickAmount: 4,
          decimalsInFloat: 0
        }
      ],
      grid: {
        show: true,
        xaxis: {
          lines: {
            show: true,
          }
        },
        yaxis: {
          lines: {
            show: false,
          }
        },
        padding: {
          top: 0,
          right: -2,
          bottom: 15,
          left: 10
        },
      },
      legend: {
        show: true,
        horizontalAlign: 'center',
        offsetX: 0,
        offsetY: -5,
        markers: {
          strokeWidth: 2,
          fillColors: colors,
          offsetX: 0,
          offsetY: 0
        },
        itemMargin: {
          horizontal: 10,
          vertical: 0
        }
      },
      tooltip: {
        shared: false,
        y: [{
          formatter: function (y: any) {
            if (typeof y !== "undefined") {
              return y.toFixed(0);
            }
            return y;
          }
        }, {
          formatter: function (y: any) {
            if (typeof y !== "undefined") {
              return "$" + y.toFixed(2) + "k";
            }
            return y;
          }
        }, {
          formatter: function (y: any) {
            if (typeof y !== "undefined") {
              return y.toFixed(0);
            }
            return y;
          }
        }]
      }
    };
  }



 // Chart Colors Set
 private getChartColorsArray(colors: any) {
  colors = JSON.parse(colors);
  return colors.map(function (value: any) {
    var newValue = value.replace(' ', '');
    if (newValue.indexOf(',') === -1) {
      var color = getComputedStyle(document.documentElement).getPropertyValue(
        newValue
      );
      if (color) {
        color = color.replace(' ', '');
        return color;
      } else {
        return newValue;
      }
    } else {
      var val = value.split(',');
      if (val.length == 2) {
        var rgbaColor = getComputedStyle(
          document.documentElement
        ).getPropertyValue(val[0]);
        rgbaColor = 'rgba(' + rgbaColor + ',' + val[1] + ')';
        return rgbaColor;
      } else {
        return newValue;
      }
    }
  });
}

// Method to create the Line Area Chart
private _lineAreaChart(paidInvoices: number, unpaidInvoices: number) {
  const colors = this.getChartColorsArray(
    '["--vz-primary-rgb, 0.2", "--vz-primary", "--vz-success-rgb, 0.2", "--vz-success"]'
  );

  // Assign the paid and unpaid invoices data to the datasets
  this.lineAreaChart = {
    labels: ['January', 'February', 'March'],
    datasets: [
      { data: [65, 59, 80], label: 'Paid Invoices' },
      { data: [28, 48, 40], label: 'Unpaid Invoices' }
    ],
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  };
  
}

/**
 * Donut Chart
 */
private _donutChart(paidInvoices: number, unpaidInvoices: number) {
  const colors = this.getChartColorsArray('["--vz-primary", "--vz-warning", "--vz-info"]');

  this.donutChart = {
    labels: ['Paid', 'Unpaid'],
    datasets: [
      {
        data: [paidInvoices, unpaidInvoices],
        backgroundColor: colors,
        hoverBackgroundColor: colors,
        hoverBorderColor: '#fff',
      },
    ],
    options: {
      maintainAspectRatio: false,
      legend: {
        position: 'top',
      },
    },
  };
}

// Load the analytics data from the service and pass it to the chart
loadAnalyticsData(): void {
  this.analyticsService
    .getPaidVsUnpaidInvoices()
    .subscribe((data: { paidInvoices: number; unpaidInvoices: number }) => {
      console.log('Paid vs Unpaid Data:', data); // Log to confirm data

      // Pass the fetched data into the Line Area Chart method
      this._lineAreaChart(data.paidInvoices, data.unpaidInvoices);
      
      // Log the chart object before rendering
      console.log('Line Area Chart Data:', this.lineAreaChart);

      // Pass the fetched data into the Donut Chart method
      this._donutChart(data.paidInvoices, data.unpaidInvoices);

      // Log the donut chart object
      console.log('Donut Chart Data:', this.donutChart);
      // Manually trigger change detection
      this.cdr.detectChanges();
    });
}


  

  goToPage(pageNumber?: number): void {
    this.homeState$ = this.customerService.customers$(pageNumber)
      .pipe(
        map(response => {
          console.log(response);
          this.dataSubject.next(response);
          this.currentPageSubject.next(pageNumber);
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.LOADED, error, appData: this.dataSubject.value })
        })
      )
  }

  goToNextOrPreviousPage(direction?: string): void {
    this.goToPage(direction === 'forward' ? this.currentPageSubject.value + 1 : this.currentPageSubject.value - 1);
  }

  selectCustomer(customer: Customer): void {
    this.router.navigate([`/customers/${customer.id}`]);
  }

  report(): void {
    this.homeState$ = this.customerService.downloadReport$()
      .pipe(
        map(response => {
          console.log(response);
          this.reportProgress(response);
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.LOADED, error, appData: this.dataSubject.value })
        })
      )
  }

  private reportProgress(httpEvent: HttpEvent<string[] | Blob>): void {
    switch (httpEvent.type) {
      case HttpEventType.DownloadProgress || HttpEventType.UploadProgress:
        this.fileStatusSubject.next({ status: 'progress', type: 'Downloading...', percent: Math.round(100 * httpEvent.loaded / httpEvent.total) });
        break;
      case HttpEventType.ResponseHeader:
        console.log('Got response Headers', httpEvent);
        break;
      case HttpEventType.Response:
        saveAs(new File([<Blob>httpEvent.body], httpEvent.headers.get('File-Name'),
          { type: `${httpEvent.headers.get('Content-Type')};charset-utf-8` }));
        this.fileStatusSubject.next(undefined);
        break;
      default:
        console.log(httpEvent);
        break;
    }
  }

}
