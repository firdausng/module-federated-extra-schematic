import { Routes } from '@angular/router';
import {<%= classify(name) %>Component} from "./<%= dasherize(name) %>.component";

export const TERMINAL_ROUTES: Routes = [
  {
    path: '',
    component: <%= classify(name) %>Component
  }
];
