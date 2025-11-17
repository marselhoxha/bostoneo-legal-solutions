import { Injectable } from '@angular/core';
import Swal, { SweetAlertResult } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  /**
   * Show success notification
   */
  success(title: string, text?: string, timer: number = 2000): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      timer,
      showConfirmButton: false
    });
  }

  /**
   * Show error notification
   */
  error(title: string, text?: string, timer?: number): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      timer
    });
  }

  /**
   * Show warning notification
   */
  warning(title: string, text?: string, timer: number = 2000): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'warning',
      title,
      text,
      timer
    });
  }

  /**
   * Show info notification
   */
  info(title: string, text?: string, timer: number = 1500): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'info',
      title,
      text,
      timer,
      showConfirmButton: false
    });
  }

  /**
   * Show loading notification
   */
  loading(title: string, text?: string): void {
    Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  /**
   * Close any open notification
   */
  close(): void {
    Swal.close();
  }

  /**
   * Show confirmation dialog
   */
  confirm(
    title: string,
    text: string,
    confirmButtonText: string = 'Yes',
    cancelButtonText: string = 'Cancel'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText
    });
  }

  /**
   * Show delete confirmation dialog
   */
  confirmDelete(
    title: string,
    text: string,
    confirmButtonText: string = 'Yes, delete it'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText
    });
  }

  /**
   * Show input prompt
   */
  async prompt(
    title: string,
    inputLabel?: string,
    inputPlaceholder?: string,
    inputType: 'text' | 'textarea' = 'text',
    validator?: (value: string) => string | null
  ): Promise<string | null> {
    const result = await Swal.fire({
      title,
      input: inputType,
      inputLabel,
      inputPlaceholder,
      showCancelButton: true,
      confirmButtonText: 'Save',
      cancelButtonText: 'Cancel',
      inputValidator: validator
    });

    return result.isConfirmed ? result.value : null;
  }

  /**
   * Show text area prompt
   */
  async promptTextArea(
    title: string,
    inputLabel?: string,
    inputPlaceholder?: string,
    validator?: (value: string) => string | null
  ): Promise<string | null> {
    return this.prompt(title, inputLabel, inputPlaceholder, 'textarea', validator);
  }
}
