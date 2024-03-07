import { Injectable } from '@angular/core';
import { Element } from '../../shared/models/element.model';
import { ElementType } from '../../shared/models/element-type.model';
import { FrankDoc as FrankDoc } from '../../shared/services/frank-doc.service';

@Injectable({
  providedIn: 'root',
})
export class PaletteService {
  data: Map<string, any[]> = new Map<string, any[]>();

  constructor(private frankDocService: FrankDoc) {
    this.getData();
  }

  getData(): void {
    this.frankDocService.getFrankDoc().subscribe({
      next: (data) => this.sortData(data),
    });
  }

  sortData(data: any): void {
    if (data.groups) {
      for (const group of data.groups) {
        const elementTypes = this.getElementTypesInGroup(group, data);
        const elements = this.getElementsForTypes(elementTypes, data);
        this.data.set(group.name, elements.flat(1));
      }
    }
  }

  getElementTypesInGroup(group: any, data: any): ElementType {
    return group.types.flatMap((groupType: any) =>
      data.types
        .find((type: any) => type.name === groupType)
        .members.map((name: string) => ({
          name,
          type: groupType,
          group: group.name,
        }))
    );
  }

  getElementsForTypes(types: ElementType, data: any): Element[] {
    const elements: Element[] = [];
    for (const type of types) {
      const element = data.elements.find(
        (element: any) => element.fullName === type.name
      );
      if (element.deprecated) {
        continue;
      }
      const elementNames = element.elementNames.map((elementName: string) => ({
        name: elementName,
        type,
      }));
      elements.push(elementNames);
    }
    return elements;
  }
}
