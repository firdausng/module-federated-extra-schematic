import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { <%= dasherize(name) %>Component } from './<%= dasherize(name) %>.component';
import {RouterModule} from "@angular/router";
import {TERMINAL_ROUTES} from "./<%= dasherize(name) %>.routes";
import {NgTerminalModule} from "ng-terminal";

@NgModule({
  declarations: [
    <%= classify(name) %>Component
  ],
  imports: [
    CommonModule,
    Ng<%= classify(name) %>Module,
    RouterModule.forChild(TERMINAL_ROUTES)
  ]
})
export class MyTerminalModule { }
