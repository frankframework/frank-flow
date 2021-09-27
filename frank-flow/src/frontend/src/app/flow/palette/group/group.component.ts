import { Component, Input } from '@angular/core';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { NodeService } from '../../node/node.service';
import { FlowStructureService } from '../../../shared/services/flow-structure.service';
import Listener from '../../node/nodes/listener.model';
import Pipe from '../../node/nodes/pipe.model';
import Exit from '../../node/nodes/exit.model';

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss'],
})
export class GroupComponent {
  @Input() foldGroup = false;
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

  addNode(pipe: any): void {
    if (this.type === 'Listeners') {
      const listener = new Listener({
        id: pipe.name,
        name: pipe.name,
        type: pipe.name,
      });
      this.flowStructureService.addListener(listener);
    } else if (this.type === 'Pipes') {
      const newPipe = new Pipe({
        id: pipe.name,
        name: pipe.name,
        type: pipe.name,
      });
      this.flowStructureService.addPipe(newPipe);
    } else if (this.type === 'Other' && pipe.name === 'Exit') {
      const exit = new Exit({ id: pipe.name, name: 'Exit', type: 'Exit' });
      this.flowStructureService.addExit(exit);
    }
  }
}
