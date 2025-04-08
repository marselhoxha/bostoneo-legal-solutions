import { ChangeDetectorRef, Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { InvoiceAnalyticsService } from 'src/app/service/invoice-analytics.service';
import { circle, latLng, tileLayer } from 'leaflet';

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

@Component({
  selector: 'app-invoice-analytics',
  templateUrl: './invoice-analytics.component.html',
  styleUrls: ['./invoice-analytics.component.scss'],
})
export class InvoiceAnalyticsComponent implements OnInit {
  breadCrumbItems!: Array<{}>;

  // Chart instance for Line Area Chart
  lineAreaChart: any;
  // Donut Chart
  donutChart: any;

  @Input() paidVsUnpaid: { paidInvoices: number; unpaidInvoices: number };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paidVsUnpaid']) {
      console.log('InvoiceAnalyticsComponent received paidVsUnpaid:', this.paidVsUnpaid);
      this.cdr.detectChanges(); // Force change detection if necessary

    }
  }


  constructor(private analyticsService: InvoiceAnalyticsService, private cdr: ChangeDetectorRef) {}

  
  ngOnInit(): void {
    this.breadCrumbItems = [
      { label: 'Charts' },
      { label: 'Chartjs', active: true },
    ];

    
    // Load the data for the chart
    this.loadAnalyticsData();
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
      labels: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
      ],
      datasets: [
        {
          label: 'Paid Invoices',
          fill: true,
          lineTension: 0.5,
          backgroundColor: colors[0],
          borderColor: colors[1],
          data: [paidInvoices, 59, 80, 81, 56, 55, 40, 55, 30, 80], // Dynamic paid invoices data
        },
        {
          label: 'Unpaid Invoices',
          fill: true,
          lineTension: 0.5,
          backgroundColor: colors[2],
          borderColor: colors[3],
          data: [unpaidInvoices, 23, 56, 65, 23, 35, 85, 25, 92, 36], // Dynamic unpaid invoices data
        },
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          xAxes: [
            {
              gridLines: {
                color: 'rgba(166, 176, 207, 0.1)',
              },
            },
          ],
          yAxes: [
            {
              ticks: {
                max: 100,
                min: 20,
                stepSize: 10,
              },
              gridLines: {
                color: 'rgba(166, 176, 207, 0.1)',
              },
            },
          ],
        },
      },
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
        console.log('Paid vs Unpaid:', data);

        // Pass the fetched data into the Line Area Chart method
        this._lineAreaChart(data.paidInvoices, data.unpaidInvoices);
        // Pass the fetched data into the Donut Chart method
        this._donutChart(data.paidInvoices, data.unpaidInvoices);
      });
  }



}
