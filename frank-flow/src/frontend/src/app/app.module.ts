import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { EditorModule } from './editor/editor.module';
import { HeaderModule } from './header/header.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FlowModule } from './flow/flow.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';

const toastrConfig = {
  positionClass: 'toast-bottom-right',
  progressBar: true,
  extendedTimeOut: 2000,
  maxOpened: 10,
  autoDismiss: true,
  preventDuplicates: true,
  countDuplicates: true,
  resetTimeoutOnDuplicate: true,
  includeTitleDuplicates: true,
};

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    EditorModule,
    HeaderModule,
    FontAwesomeModule,
    FlowModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot(toastrConfig),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
