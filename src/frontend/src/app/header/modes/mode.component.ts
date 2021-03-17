import { Component, OnInit } from '@angular/core';
import { Mode } from './mode.model';
import { ModeService } from './mode.service';
import { ModeType } from './modeType.enum';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faCode,
  faColumns,
  faProjectDiagram,
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-modes',
  templateUrl: './mode.component.html',
  styleUrls: ['./mode.component.scss'],
})
export class ModeComponent implements OnInit {
  modeType = ModeType;
  mode!: Mode;

  constructor(private modeService: ModeService, library: FaIconLibrary) {
    library.addIcons(faCode, faProjectDiagram, faColumns);
  }

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
