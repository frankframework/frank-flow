import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { IbisDocService } from 'src/app/shared/services/ibis-doc.service';
import { Node } from '../node/nodes/node.model';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent {
  node?: Node;
  attributeOptions: any[] = [];
  ibisDoc: any;
  selectedAttribute!: any;
  // toStr = JSON.stringify;
  // newAttributePlaceholder = '';

  // changeNewAttribute(): void {
  //   this.newAttributePlaceholder = JSON.parse(this.selectedAttribute).defaultValue;
  // }

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private ibisDocService: IbisDocService
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
    const nodeName = this.node?.getName();
    if (nodeName && this.ibisDoc) {
      const pipe = this.ibisDoc[2].classes.filter(
        (node: any) => node.name === nodeName
      );
      pipe[0].methods.forEach((method: any) => {
        this.attributeOptions.push(method);
      });
    }
  }
}
