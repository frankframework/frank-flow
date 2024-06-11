import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
})
export class EditorComponent {
  @Output()
  finishedLoading: EventEmitter<boolean> = new EventEmitter<boolean>();

  triggerFinishedLoading(): void {
    this.finishedLoading.emit();
  }
}
