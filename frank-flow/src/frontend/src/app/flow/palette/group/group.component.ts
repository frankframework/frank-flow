import { Component, Input } from '@angular/core';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { NodeService } from '../../node/node.service';
import { FlowStructureService } from '../../../shared/services/flow-structure.service';
import Listener from '../../node/nodes/listener.model';
import Pipe from '../../node/nodes/pipe.model';
import Exit from '../../node/nodes/exit.model';
import Sender from '../../node/nodes/sender.model';

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss'],
})
export class GroupComponent {
  @Input() foldGroup = false;
  @Input() locked = false;
  @Input() color = 'primary';
  @Input() type = 'default';
  @Input() items!: any[] | undefined;

  constructor(
    private nodeService: NodeService,
    private flowStructureService: FlowStructureService
  ) {}

  foldArrow = () => (this.foldGroup ? faChevronDown : faChevronUp);

  toggleFold(): void {
    this.foldGroup = !this.foldGroup;
  }

  addNode(node: any): void {
    if (this.locked) {
      return;
    }
    switch (this.type) {
      case 'Listeners': {
        const listener = new Listener({
          id: node.name,
          name: node.name,
          type: node.name,
        });
        this.flowStructureService.addListener(listener);

        break;
      }
      case 'Pipes': {
        const newPipe = new Pipe({
          id: node.name,
          name: node.name,
          type: node.name,
        });
        this.flowStructureService.addPipe(newPipe);

        break;
      }
      case 'Senders': {
        const sender = new Sender({
          id: node.name,
          name: node.name,
          type: node.name,
        });
        this.flowStructureService.addSender(sender);

        break;
      }
      default:
        if (this.type === 'Other' && node.name === 'Exit') {
          const exit = new Exit({ id: node.name, name: 'Exit', type: 'Exit' });
          this.flowStructureService.addExit(exit);
        }
    }
  }
}
