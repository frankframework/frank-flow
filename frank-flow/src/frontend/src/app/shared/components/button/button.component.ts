import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-button',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
})
export class ButtonComponent {
  @Input() color = 'default';
  @Input() block = false;
  @Input() selected?: boolean;

  constructor() {}
}
