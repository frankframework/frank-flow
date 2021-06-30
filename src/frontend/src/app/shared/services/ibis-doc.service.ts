import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {Observable, Subject} from 'rxjs';
import {ToastrService} from 'ngx-toastr';

@Injectable({
  providedIn: 'root',
})
export class IbisDocService {
  ibisDoc = new Subject<any>();

  constructor(private toastr: ToastrService) {
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
        this.toastr.error(
          'The ibisdoc cant be loaded from the Frank!Framework',
          'Loading error'
        );
        console.error(error)
      });
  }

  getIbisDoc(): Observable<any> {
    return this.ibisDoc.asObservable();
  }
}
