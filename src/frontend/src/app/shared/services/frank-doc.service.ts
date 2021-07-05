import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FrankDocService {
  frankDoc = new Subject<any>();

  constructor() {
    this.fetchFrankDoc();
  }

  fetchFrankDoc(): void {
    fetch(environment.runnerUri + environment.frankDocJsonPath, {
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
}
