import { Injectable } from '@angular/core';
import { File } from '../models/file.model';
import { ModeType } from '../../header/modes/mode-type.enum';
import { Mode } from '../../header/modes/mode.model';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  constructor() {}

  setSessionFile(file: File): void {
    localStorage.setItem('file', JSON.stringify(file));
  }

  getSessionFile(): File | undefined {
    const sessionFile = localStorage.getItem('file');
    return sessionFile ? JSON.parse(sessionFile) : sessionFile;
  }

  setSessionMode(mode: Mode): void {
    localStorage.setItem('mode', JSON.stringify(mode));
  }

  getSessionMode(): Mode | undefined {
    const sessionMode = localStorage.getItem('mode');
    return sessionMode ? JSON.parse(sessionMode) : sessionMode;
  }
}
