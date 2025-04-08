import { Component, Input } from "@angular/core";

@Component({
  selector: 'app-preloader', // Ensure this matches what you're using in the template
  templateUrl: './preloader.component.html',
  styleUrls: ['./preloader.component.css'],
})
export class PreloaderComponent {
    @Input() isHidden = false;
}
