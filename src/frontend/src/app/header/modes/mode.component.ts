import { Component, OnInit } from '@angular/core';
import { Mode } from './mode';
import { ModeService } from './mode.service';
import { ModeType } from './modeType';

@Component({
  selector: 'app-modes',
  templateUrl: './mode.component.html',
  styleUrls: ['./mode.component.scss'],
})
export class ModeComponent implements OnInit {
  modeType = ModeType;
  mode!: Mode;

  constructor(private modeService: ModeService) {}

  ngOnInit(): void {
    this.getMode();
  }

  getMode(): void {
    this.modeService.getMode().subscribe((mode) => (this.mode = mode));
  }

  setMode(modeType: ModeType): void {
    this.mode.set(modeType);
    this.modeService.setMode(this.mode);
  }
}
