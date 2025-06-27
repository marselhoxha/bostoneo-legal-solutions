import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-task-management',
  template: '<div><h2>Task Management</h2><p>Component is loading...</p></div>',
  styleUrls: ['./task-management.component.css']
})
export class TaskManagementComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
    console.log('TaskManagementComponent initialized');
  }

}
