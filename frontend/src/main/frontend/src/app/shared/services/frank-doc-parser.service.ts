import {
  FrankDoc as FrankDocument,
  Element,
  Group,
  TypeElement,
  Attribute,
  Enum,
} from '../models/frank-doc.model';
import { Injectable } from '@angular/core';
import { FrankDoc } from './frank-doc.service';

@Injectable({
  providedIn: 'root',
})
export class FrankDocParser {
  private frankDoc!: FrankDocument;

  constructor(private frankDocService: FrankDoc) {
    this.getFrankDoc();
  }

  private getFrankDoc() {
    this.frankDocService.getFrankDoc().subscribe((frankDoc) => {
      this.frankDoc = frankDoc;
    });
  }

  public searchElement(
    searchTerm: string,
    elements = this.frankDoc.elements
  ): Element[] {
    return elements.filter((element) =>
      element.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  public searchElementByElementNames(
    searchTerm: string,
    elements = this.frankDoc.elements
  ): Element[] {
    return elements.filter((element) =>
      element.elementNames.find((elementName) =>
        elementName.includes(searchTerm)
      )
    );
  }

  public getElement(name: string): Element {
    return this.frankDoc.elements.find((element) => element.name === name)!;
  }

  public getElementNames(elements: Element[]): string[] {
    return elements.flatMap((element) => element.elementNames);
  }

  public getElementByFullName(fullName: string): Element {
    return this.frankDoc.elements.find(
      (element) => element.fullName === fullName
    )!;
  }

  public getElementByElementName(elementName: string): Element {
    return this.frankDoc.elements.find((element) =>
      element.elementNames.includes(elementName)
    )!;
  }

  public getAttributes(element: Element): Attribute[] {
    let attributes = element.attributes || [];
    if (element.parent) {
      const parent = this.getElementByFullName(element.parent);
      attributes = [...this.getAttributes(parent), ...attributes];
    }
    return attributes;
  }

  public getAttribute(element: Element, name: string): Attribute {
    return this.getAttributes(element).find(
      (attribute) => attribute.name === name
    )!;
  }

  public searchAttribute(
    searchTerm: string,
    searchArray: Attribute[]
  ): Attribute[] {
    return searchArray.filter((attribute) =>
      attribute.name.includes(searchTerm)
    );
  }

  public getEnumFromAttribute(attribute: Attribute): Enum {
    return this.getEnum(attribute.enum!);
  }

  public getEnum(name: string): Enum {
    return this.frankDoc.enums.find(
      (enumElement) => enumElement.name === name
    )!;
  }

  public getGroup(name: string): Group {
    return this.frankDoc.groups.find((group) => group.name === name)!;
  }

  public getType(name: string): TypeElement {
    return this.frankDoc.types.find((type) => type.name === name)!;
  }

  public getElementsForType(type: TypeElement): Element[] {
    return type.members.map((member) => this.getElementByFullName(member));
  }

  public getElementsInGroup(groupName: string): Element[] {
    const group = this.getGroup(groupName);
    return group.types.flatMap((type) =>
      this.getElementsForType(this.getType(type))
    );
  }

  public getChildren(element: Element): Element[] {
    return (
      element.children?.flatMap((child) =>
        this.getElementsForType(this.getType(child.type!))
      ) || []
    );
  }

  public removeDuplicateElements(array: Element[]): Element[] {
    return [...new Set(array)];
  }

  public removeDuplicateAttributes(array: Attribute[]): Attribute[] {
    const map = new Map<string, Attribute>();
    for (const attribute of array) {
      map.set(attribute.name, attribute);
    }
    return [...map.values()];
  }

  public getMandatoryAttributes(element: Element) {
    const attributes = this.getAttributes(element);
    return attributes.filter((attribute) => attribute.mandatory);
  }

  public getChildrenWithInheritance(element: Element): Element[] {
    let children = this.getChildren(element);
    if (element.parent) {
      const parent = this.getElementByFullName(element.parent);
      children = [...this.getChildrenWithInheritance(parent), ...children];
    }
    return children;
  }
}
