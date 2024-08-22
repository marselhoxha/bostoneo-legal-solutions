import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/interface/user';
import { UserService } from 'src/app/service/user.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Input() user: User;

  constructor(private router: Router, private userService: UserService) { }

  logOut(): void{
    this.userService.logOut();
    this.router.navigate(['/login']);
  }
 

}
