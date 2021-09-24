import { Component, Input } from '@angular/core';
import { faCloudDownloadAlt } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-item',
  templateUrl: './item.component.html',
  styleUrls: ['./item.component.scss'],
})
export class ItemComponent {
  cloud = faCloudDownloadAlt;

  @Input() color!: string;
  @Input() name!: string;

  constructor() {}
}
