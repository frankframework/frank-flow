import { Component, OnInit } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss'],
})
export class PaletteComponent implements OnInit {
  data: Map<string, any[]> = new Map<string, any[]>();
  search!: string;

  constructor(private toastr: ToastrService) {}

  ngOnInit(): void {
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
