// Polyfill for process (must be first)
(window as any).process = require('process/browser');
global.process = (window as any).process;

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err)); 