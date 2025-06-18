import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-time-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-reports.component.html',
  styleUrls: ['./time-reports.component.scss']
})
export class TimeReportsComponent implements OnInit {

  ngOnInit(): void {
    console.log('Time Reports loaded successfully!');
  }
} 