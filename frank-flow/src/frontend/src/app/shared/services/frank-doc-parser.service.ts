import {
  FrankDoc as FrankDocument,
  Element,
  Group,
  TypeElement,
  Attribute,
  Enum,
} from '../models/frank-doc.model';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FrankDocParser {
  private frankDoc: FrankDocument;

  constructor(frankDoc: FrankDocument) {
    this.frankDoc = frankDoc;
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

  public getElement(name: string): Element | undefined {
    return this.frankDoc.elements.find((element) => element.name === name);
  }

  public getElementNames(elements: Element[]): string[] {
    return elements.flatMap((element) => element.elementNames);
  }

  public getElementByFullName(fullName: string): Element | undefined {
    return this.frankDoc.elements.find(
      (element) => element.fullName === fullName
    );
  }

  public getElementByElementName(elementName: string): Element | undefined {
    return this.frankDoc.elements.find((element) =>
      element.elementNames.includes(elementName)
    );
  }

  public getAttributes(element: Element): Attribute[] {
    let attributes = element.attributes || [];
    if (!element.parent) return attributes;
    const parent = this.getElementByFullName(element.parent);
    if (!parent) return attributes;
    attributes = [...attributes, ...this.getAttributes(parent)];
    return attributes;
  }

  public getAttribute(element: Element, name: string): Attribute | undefined {
    return this.getAttributes(element).find(
      (attribute) => attribute.name === name
    );
  }

  public searchAttribute(
    searchTerm: string,
    searchArray: Attribute[]
  ): Attribute[] {
    return searchArray.filter((attribute) =>
      attribute.name.includes(searchTerm)
    );
  }

  public getEnumFromAttribute(attribute: Attribute): Enum | undefined {
    if (!attribute.enum) return;
    return this.getEnum(attribute.enum);
  }

  public getEnum(name: string): Enum | undefined {
    return this.frankDoc.enums.find((enumElement) => enumElement.name === name);
  }

  public getGroup(name: string): Group | undefined {
    return this.frankDoc.groups.find((group) => group.name === name);
  }

  public getType(name: string): TypeElement | undefined {
    return this.frankDoc.types.find((type) => type.name === name);
  }

  public getElementsForType(type: TypeElement): (Element | undefined)[] {
    return type.members.map((member) => this.getElementByFullName(member));
  }

  public getElementsInGroup(groupName: string): (Element | undefined)[] {
    const group = this.getGroup(groupName);
    if (!group) return [];
    return group.types.flatMap((groupType) => {
      const type = this.getType(groupType);
      if (!type) return;
      return this.getElementsForType(type);
    });
  }

  public getChildren(element: Element): (Element | undefined)[] {
    if (!element.children) return [];
    return element.children.flatMap((child) => {
      if (!child.type) return;
      const type = this.getType(child.type);
      if (!type) return;
      return this.getElementsForType(type);
    });
  }

  public removeDuplicateElements(array: Element[]): Element[] {
    return array.filter((element, index) => array.indexOf(element) === index);
  }

  public getMandatoryAttributes(element: Element) {
    const attributes = this.getAttributes(element);
    return attributes.filter((attribute) => attribute.mandatory);
  }
}
