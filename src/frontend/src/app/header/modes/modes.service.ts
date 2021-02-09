import { Injectable } from '@angular/core';
import { Modes } from './modes';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ModesService {
  modes: Modes;

  constructor() {
    this.modes = {
      editorMode: false,
      flowMode: true,
    };
  }

  setModes(modes: Modes): void {
    this.modes = modes;
  }

  getModes(): Observable<Modes> {
    return of(this.modes);
  }
}
