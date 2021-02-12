import { Component, OnInit } from '@angular/core';
import { Mode } from './header/modes/mode';
import { ModeService } from './header/modes/mode.service';
import { ModeType } from './header/modes/modeType';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  modeType = ModeType;
  mode!: Mode;

  constructor(private modeService: ModeService) {}

  ngOnInit(): void {
    this.getModes();
  }

  getModes(): void {
    this.modeService.getMode().subscribe((mode) => (this.mode = mode));
  }
}
