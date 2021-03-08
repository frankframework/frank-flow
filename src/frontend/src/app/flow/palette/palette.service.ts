import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root',
})
export class PaletteService {
  data: Map<string, any[]> = new Map<string, any[]>();

  constructor(private toastr: ToastrService) {
    this.getData();
  }

  getData(): void {
    fetch(environment.runnerUri + environment.ibisdocJsonPath, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
      .then((result) => result.json())
      .then((data) =>
        data.forEach((group: any) => {
          this.data.set(group.name, group.classes);
        })
      )
      .catch((error) => {
        this.toastr.error(
          'The ibisdoc cant be loaded from the Frank!Runner',
          'Loading error'
        );
        console.error(error);
      });
  }
}
