import { Injectable } from '@angular/core';
import { Adapter } from '../models/adapter.model';
import { Observable, ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CurrentAdapterService {
  private currentAdapter!: Adapter;
  private currentAdapterSubject: ReplaySubject<Adapter> =
    new ReplaySubject<Adapter>(1);
  public currentAdapterObservable: Observable<Adapter> =
    this.currentAdapterSubject.asObservable();
  constructor() {}
}
