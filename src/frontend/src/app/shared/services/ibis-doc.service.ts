import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class IbisDocService {
  ibisDoc = new Subject<any>();

  constructor() {
    this.fetchIbisDoc();
  }

  fetchIbisDoc(): void {
    fetch(environment.runnerUri + environment.ibisdocJsonPath, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
      .then((result) => result.json())
      .then((json) => this.ibisDoc.next(json))
      .catch((error) => {
        console.error(error);
      });
  }

  getIbisDoc(): Observable<any> {
    return this.ibisDoc.asObservable();
  }
}
