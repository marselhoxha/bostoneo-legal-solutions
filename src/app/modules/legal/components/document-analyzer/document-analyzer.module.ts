import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DocumentAnalyzerComponent } from './document-analyzer.component';

@NgModule({
  imports: [
    RouterModule.forChild([
      { path: '', component: DocumentAnalyzerComponent }
    ]),
    DocumentAnalyzerComponent // Import the standalone component
  ]
})
export class DocumentAnalyzerModule { }