import { Injectable } from '@angular/core';
import { Element } from '../../shared/models/element.model';
import { ElementType } from '../../shared/models/element-type.model';
import { FrankDocService } from '../../shared/services/frank-doc.service';

@Injectable({
  providedIn: 'root',
})
export class PaletteService {
  data: Map<string, any[]> = new Map<string, any[]>();

  constructor(private frankDocService: FrankDocService) {
    this.getData();
  }

  getData(): void {
    this.frankDocService.getFrankDoc().subscribe({
      next: (data) => this.sortData(data),
    });
  }

  sortData(data: any): void {
    if (data.groups) {
      data.groups.forEach((group: any) => {
        const elementTypes = this.getElementTypesInGroup(group, data);
        const elements = this.getElementsForTypes(elementTypes, data);
        this.data.set(group.name, elements);
      });
    }
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
