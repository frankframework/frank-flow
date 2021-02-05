import {Component, Input, OnInit} from '@angular/core';
import {faChevronDown, faChevronUp} from "@fortawesome/free-solid-svg-icons";
import {IconProp} from "@fortawesome/fontawesome-svg-core";

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss']
})
export class GroupComponent implements OnInit {
  @Input() foldGroup = false
  @Input() border = 'primary'
  foldArrow = () => this.foldGroup ? faChevronDown : faChevronUp;

  constructor() { }

  ngOnInit(): void {
  }

  toggleFold(): void {
    this.foldGroup = !this.foldGroup;
  }
}
