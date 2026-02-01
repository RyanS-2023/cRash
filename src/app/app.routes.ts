import { Routes } from '@angular/router';
import { SkolSlotComponent } from './skol-slot/skol-slot';

export const routes: Routes = [
  { path: '', redirectTo: 'skol-slot', pathMatch: 'full' },
  { path: 'skol-slot', component: SkolSlotComponent },
];
