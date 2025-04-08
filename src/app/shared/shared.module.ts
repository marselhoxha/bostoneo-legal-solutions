import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { ExtractArrayValue } from "../pipes/extractvalue.pipe";
import { PreloaderComponent } from "../component/preloader/preloader.component";

@NgModule({
  declarations: [ ExtractArrayValue ],
  imports: [ RouterModule, CommonModule, FormsModule],
  exports: [ RouterModule, CommonModule, FormsModule, ExtractArrayValue ],
  
})
export class SharedModule { }
