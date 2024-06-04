import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { Subscription } from 'rxjs';
import { FrankDoc } from '../../services/frank-doc.service';
import { FlowStructureNode } from '../../models/flow-structure-node.model';
import { CreateForwardModalData } from './create-forward-modal-data.model';
import { ToastrService } from 'ngx-toastr';
import { jsPlumbInstance } from 'jsplumb';
import { NodeService } from '../../../flow/node/node.service';
import { CurrentFileService } from '../../services/current-file.service';

@Component({
  selector: 'app-create-forward',
  templateUrl: './create-forward.component.html',
  styleUrls: ['./create-forward.component.scss'],
})
export class CreateForwardComponent {
  private frankDocSubscription!: Subscription;
  private frankDoc!: any;
  private frankDocElement!: any | undefined;
  private frankDocParentElements: any[] = [];
  private actionFunction(
    sourceNode: FlowStructureNode,
    targetId: string,
    forwardName: string
  ) {}
  private modalData!: CreateForwardModalData;
  private jsPlumbInstance!: jsPlumbInstance;

  public forwards: FlowStructureNode[] = [];
  public forward: any;

  constructor(
    private nodeService: NodeService,
    private ngxSmartModalService: NgxSmartModalService,
    private frankDocService: FrankDoc,
    private toastr: ToastrService,
    private currentFileService: CurrentFileService
  ) {
    this.jsPlumbInstance = this.nodeService.getInstance();
  }

  onDataAdded(): void {
    this.frankDocParentElements = [];
    this.forward = undefined;
    this.modalData = this.ngxSmartModalService.getModalData('createForward');
    this.actionFunction = this.modalData.actionFunction;
    this.getFrankDoc();
    this.getFrankDocElement();
    this.getFrankDocParentElements(this.frankDocElement?.fullName);
    this.getForwardsForNode();
    this.checkAvailableForwards();
  }

  getFrankDoc(): void {
    this.frankDocSubscription = this.frankDocService
      .getFrankDoc()
      .subscribe((frankDoc: any) => (this.frankDoc = frankDoc));
  }

  getFrankDocElement() {
    this.frankDocElement = this.frankDoc.elements.find((element: any) =>
      element.elementNames.includes(this.modalData.node.type)
    );
  }

  getFrankDocParentElements(fullParentName: string | undefined) {
    const parent = this.frankDoc.elements.find(
      (element: any) => element.fullName === fullParentName
    );

    this.frankDocParentElements.push(parent);

    if (parent?.parent) {
      this.getFrankDocParentElements(parent.parent);
    }
  }

  getForwardsForNode(): void {
    this.forwards = [];

    for (const forward of this.frankDocElement?.forwards ?? []) {
      if (!this.checkExistingForwards(forward.name)) {
        this.forwards.push(forward);
      }
    }

    for (const parent of this.frankDocParentElements ?? []) {
      for (const forward of parent.forwards ?? []) {
        if (
          !this.forwards.includes(forward) &&
          !this.checkExistingForwards(forward.name)
        ) {
          this.forwards.push(forward);
        }
      }
    }
  }

  checkExistingForwards(forwardType: string): boolean {
    return this.modalData.node.forwards?.find(
      (forward) => forward.name === forwardType
    );
  }

  checkAvailableForwards(): void {
    if (this.forwards.length > 0) {
      this.ngxSmartModalService.open('createForward');
    } else {
      this.currentFileService.refreshFile();
      this.toastr.error(
        'All possible forwards have already been added, these can be changed by editing the code in de editor',
        'All forwards already defined'
      );
    }
  }

  confirm(): void {
    this.actionFunction(
      this.modalData.node,
      this.modalData.targetId,
      this.forward.name
    );
    this.ngxSmartModalService.close('createForward');
  }

  cancel(): void {
    this.ngxSmartModalService.close('createForward');
    this.currentFileService.refreshFile();
  }
}
