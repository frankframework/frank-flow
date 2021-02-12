import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { EditorModule } from './editor/editor.module';
import { HeaderModule } from './header/header.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TreeviewModule } from 'ngx-treeview';
import { FlowModule } from './flow/flow.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    EditorModule,
    HeaderModule,
    FontAwesomeModule,
    TreeviewModule.forRoot(),
    FlowModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
