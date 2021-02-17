import { Component } from '@angular/core';
import { NgxSmartModalService } from 'ngx-smart-modal';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
})
export class OptionsComponent {
  node = { name: '' };
  toggle = false;

  constructor(private ngxSmartModalService: NgxSmartModalService) {}

  onDataAdded(): void {
    this.node = this.ngxSmartModalService.getModalData('optionsModal');
  }
}
