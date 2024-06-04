import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent {
  @Input() term!: string;
  @Output() termChange = new EventEmitter<string>();

  constructor() {}

  changeState(): void {
    this.termChange.emit(this.term);
  }
}
