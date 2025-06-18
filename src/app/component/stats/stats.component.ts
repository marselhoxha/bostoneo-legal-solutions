import { AfterViewInit, ChangeDetectionStrategy, Component, Input, OnInit, SimpleChanges, } from '@angular/core';
import { Stats } from 'src/app/interface/stats';
import * as feather from 'feather-icons';
import Odometer from 'odometer';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsComponent implements AfterViewInit {
  @Input() stats: Stats;
  odometerClients: any;
  odometerInvoices: any;
  odometerBilled: any;

  ngAfterViewInit(): void {
    // Initialize Odometers
    this.odometerClients = new Odometer({
      el: document.querySelector('.odometer-clients'),
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

    // Set initial values
    if (this.stats) {
      this.updateOdometers();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update odometers when `stats` input changes
    if (changes['stats'] && changes['stats'].currentValue) {
      this.updateOdometers();
    }
  }

  
  // Function to update odometers after a delay
  updateOdometers(): void {
    // Use a timeout to delay the update for 1 second (1000ms)
    setTimeout(() => {
      this.odometerClients.update(this.stats?.totalClients || 0);
      this.odometerInvoices.update(this.stats?.totalInvoices || 0);
      this.odometerBilled.update(this.stats?.totalBilled || 0);
    }, 1000); // Delay for 1 second (1000ms)
  }
}

