import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable, ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FrankDocService {
  frankDoc = new ReplaySubject<any>(1);
  frankDocXsd = new ReplaySubject<any>(1);
  frankDocXsdObservable = this.frankDocXsd.asObservable();

  constructor() {
    this.fetchFrankDoc();
    this.fetchFrankDocXsd();
  }

  fetchFrankDoc(): void {
    fetch(window.location.origin + '/' + environment.frankDocJsonPath, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
      .then((result) => result.json())
      .then((json) => this.frankDoc.next(json))
      .catch((error) => {
        console.error(error);
      });
  }

  getFrankDoc(): Observable<any> {
    return this.frankDoc.asObservable();
  }

  fetchFrankDocXsd(): void {
    fetch(window.location.origin + '/' + environment.frankDocXsdPath, {
      method: 'GET',
      headers: {
        Accept: 'application/xml',
      },
    })
      .then((result) => result.text())
      .then((xml) => this.frankDocXsd.next(xml))
      .catch((error) => {
        console.error(error);
      });
  }
}
