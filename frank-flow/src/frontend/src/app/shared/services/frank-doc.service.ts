import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable, ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FrankDoc {
  private readonly frankDocUrl =
    environment.originURL + environment.frankDocJsonPath;
  private frankDoc = new ReplaySubject<any>(1);

  constructor() {
    this.fetchFrankDoc();
  }

  fetchFrankDoc(): void {
    fetch(this.frankDocUrl, {
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
