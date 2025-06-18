import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Key } from '../enum/key.enum';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    const token = localStorage.getItem(Key.TOKEN);
    if (token) {
      return true;
    }
    this.router.navigate(['/login']);
    return false;
  }
}
