import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';
import { Subscription } from 'rxjs';
import { FrankDocumentService } from '../../services/frank-document.service';
import { FlowStructureNode } from '../../models/flow-structure-node.model';
import { CreateForwardModalData } from './create-forward-modal-data.model';

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

  public forwards: FlowStructureNode[] = [];
  public forward: any;

  constructor(
    private ngxSmartModalService: NgxSmartModalService,
    private frankDocumentService: FrankDocumentService
  ) {}

  onDataAdded(): void {
    this.modalData = this.ngxSmartModalService.getModalData('createForward');
    this.actionFunction = this.modalData.actionFunction;
    this.getFrankDoc();
    this.getFrankDocElement();
    this.getFrankDocParentElements(this.frankDocElement?.fullName);
    this.getForwardsForNode();
    this.forward = undefined;
  }

  getFrankDoc(): void {
    this.frankDocSubscription = this.frankDocumentService
      .getFrankDoc()
      .subscribe((frankDocument: any) => (this.frankDoc = frankDocument));
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
  }
}
