import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  constructor(private modalService: NgbModal) {}
  
  /**
   * Open a modal with the specified component
   */
  open(content: any, options?: any) {
    return this.modalService.open(content, options);
  }
} 
 