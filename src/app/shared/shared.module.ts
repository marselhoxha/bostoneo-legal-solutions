import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { ExtractArrayValue } from "../pipes/extractvalue.pipe";
import { PreloaderComponent } from "../component/preloader/preloader.component";
import { SafePipe } from './pipes/safe.pipe';
import { CountUpDirective } from './directives/count-up.directive';

@NgModule({
  declarations: [ 
    ExtractArrayValue, 
    SafePipe,
    CountUpDirective
  ],
  imports: [ RouterModule, CommonModule, FormsModule],
  exports: [ 
    RouterModule, 
    CommonModule, 
    FormsModule, 
    ExtractArrayValue, 
    SafePipe,
    CountUpDirective
  ],
  
})
export class SharedModule { }
