import { Injectable } from '@angular/core';
import { File } from '../models/file.model';
import { CurrentFileService } from './current-file.service';
import { FileService } from './file.service';

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
}
