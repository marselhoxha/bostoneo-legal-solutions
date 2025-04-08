import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PreloaderService {
  private showPreloaderSubject = new BehaviorSubject<boolean>(true);
  showPreloader$ = this.showPreloaderSubject.asObservable();

  show() {
    this.showPreloaderSubject.next(true);
  }

  hide() {
    this.showPreloaderSubject.next(false);
  }
}
