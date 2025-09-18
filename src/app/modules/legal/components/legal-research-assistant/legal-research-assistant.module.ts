import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LegalResearchAssistantComponent } from './legal-research-assistant.component';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';

@NgModule({
  declarations: [
    LegalResearchAssistantComponent,
    MarkdownPipe
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild([
      { path: '', component: LegalResearchAssistantComponent }
    ])
  ]
})
export class LegalResearchAssistantModule { }