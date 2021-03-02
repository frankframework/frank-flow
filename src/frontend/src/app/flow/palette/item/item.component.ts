import { Component, Input, OnInit } from '@angular/core';
import { faCloudDownloadAlt } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-item',
  templateUrl: './item.component.html',
  styleUrls: ['./item.component.scss'],
})
export class ItemComponent implements OnInit {
  cloud = faCloudDownloadAlt;

  @Input() color!: string;
  @Input() name!: string;

  constructor() {}

  ngOnInit(): void {}
}
