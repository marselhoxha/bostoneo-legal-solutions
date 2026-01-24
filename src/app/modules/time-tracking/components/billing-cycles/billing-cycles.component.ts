import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-billing-cycles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './billing-cycles.component.html',
  styleUrls: ['./billing-cycles.component.scss']
})
export class BillingCyclesComponent implements OnInit {

  ngOnInit(): void {
    // Component initialized
  }
} 