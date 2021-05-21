import { Component, Input } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { FlowStructureService } from 'src/app/shared/services/flow-structure.service';
import { IbisDocService } from 'src/app/shared/services/ibis-doc.service';
import { Node } from '../node/nodes/node.model';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent {
  ibisDoc: any;
  node?: Node;
  attributes!: [{ [key: string]: string }];
  attributeOptions: any[] = [];
  selectedAttribute!: any;
  newAttributeValue!: string;
  disabledAttributes = ['line', 'startColumn', 'endColumn', 'x', 'y'];

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private ibisDocService: IbisDocService,
    private flowStructureService: FlowStructureService
  ) {
    this.getIbisDoc();
  }

  getIbisDoc(): void {
    this.ibisDocService
      .getIbisDoc()
      .subscribe((ibisDoc: any) => (this.ibisDoc = ibisDoc));
  }

  onDataAdded(): void {
    this.node = this.ngxSmartModalService.getModalData('optionsModal');
    this.getAttributesForNode();
  }

  getAttributesForNode(): void {
    const attributes = this.node?.getAttributes();

    if (attributes) {
      this.attributes = attributes as [{ [key: string]: string }];
    }

    const nodeType = this.node?.getType();

    if (nodeType && this.ibisDoc) {
      const pipe = this.ibisDoc[2].classes.filter(
        (node: any) => node.name === nodeType || node.name + 'Pipe' === nodeType
      );
      pipe[0].methods.forEach((method: any) => {
        this.attributeOptions.push(method);
      });
    }
  }

  refreshAttributes(): void {
    const nodeType = this.node?.getType();
    const nodeName = this.node?.getName();
    const structure = this.flowStructureService.getStructure();

    console.log(structure);
  }

  changeAttribute(key: string, attribute: any, attributeList: any): void {
    // console.log('edit: ', attribute, attributeList);
    this.refreshAttributes();
    this.flowStructureService.editAttribute(key, attribute[key], attributeList);
  }

  customTrackBy(index: number, obj: any): any {
    return index;
  }
}
