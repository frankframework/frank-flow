import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { Element } from '../../shared/models/element.model';
import { ElementType } from '../../shared/models/element-type.model';

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
      .then((data) => {
        this.sortData(data);
      })
      .catch((error) => {
        this.toastr.error(
          'The ibisdoc cant be loaded from the Frank!Framework',
          'Loading error'
        );
        console.error(error);
      });
  }

  sortData(data: any): void {
    data.groups.forEach((group: any) => {
      const elementTypes = this.getElementTypesInGroup(group, data);
      const elements = this.getElementsForTypes(elementTypes, data);
      this.data.set(group.name, elements);
    });
  }

  getElementTypesInGroup(group: any, data: any): ElementType {
    return group.types
      .map((groupType: any) =>
        data.types
          .find((type: any) => type.name === groupType)
          .members.map((name: string) => ({
            name,
            type: groupType,
            group: group.name,
          }))
      )
      .flat(1);
  }

  getElementsForTypes(types: ElementType, data: any): Element {
    return types.map((type: ElementType) => ({
      name: data.elements.find((element: any) => element.fullName === type.name)
        .name,
      type,
    })) as Element;
  }
}
