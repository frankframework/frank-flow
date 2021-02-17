import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-toggle',
  templateUrl: './toggle.component.html',
  styleUrls: ['./toggle.component.scss'],
})
export class ToggleComponent {
  @Input() state = false;
  @Output() stateChange = new EventEmitter<boolean>();

  changeState(): void {
    this.stateChange.emit(this.state);
  }
}
