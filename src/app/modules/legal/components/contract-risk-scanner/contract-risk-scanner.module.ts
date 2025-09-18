import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ContractRiskScannerComponent } from './contract-risk-scanner.component';

@NgModule({
  declarations: [
    ContractRiskScannerComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild([
      { path: '', component: ContractRiskScannerComponent }
    ])
  ]
})
export class ContractRiskScannerModule { }