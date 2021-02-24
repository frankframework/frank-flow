import { Component, Input, OnInit } from '@angular/core';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { Node } from '../../node/node';

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss'],
})
export class GroupComponent implements OnInit {
  @Input() foldGroup = false;
  @Input() color = 'primary';
  @Input() items!: Node[];

  constructor() {}

  foldArrow = () => (this.foldGroup ? faChevronDown : faChevronUp);

  ngOnInit(): void {}

  toggleFold(): void {
    this.foldGroup = !this.foldGroup;
  }
}
