import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AiAssistantRoutingModule } from './ai-assistant-routing.module';
import { FlatpickrModule } from 'angularx-flatpickr';
import { QuillModule } from 'ngx-quill';

// Services
import { AiAssistantService } from '../../../../service/ai-assistant.service';
import { AIDocumentService } from './services/ai-document.service';
import { AITemplateService } from './services/ai-template.service';
import { AICollaborationService } from './services/ai-collaboration.service';
import { AiDraftingComponent } from './ai-drafting/ai-drafting.component';

@NgModule({
  declarations: [
    // Standalone components will be loaded lazily
  
    AiDraftingComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AiAssistantRoutingModule,
    FlatpickrModule.forRoot(),
    QuillModule.forRoot()
  ],
  providers: [
    AiAssistantService,
    AIDocumentService,
    AITemplateService,
    AICollaborationService
  ]
})
export class AiAssistantModule { }