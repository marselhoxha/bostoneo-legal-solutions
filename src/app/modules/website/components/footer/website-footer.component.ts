import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-website-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './website-footer.component.html',
  styleUrls: ['./website-footer.component.scss']
})
export class WebsiteFooterComponent {
  currentYear = new Date().getFullYear();
}
