import { Component, OnInit } from '@angular/core';
import { Modes } from './modes';
import { ModesService } from './modes.service';

@Component({
  selector: 'app-modes',
  templateUrl: './modes.component.html',
  styleUrls: ['./modes.component.scss'],
})
export class ModesComponent implements OnInit {
  modes!: Modes;

  constructor(private modesService: ModesService) {}

  ngOnInit(): void {
    this.getModes();
  }

  getModes(): void {
    this.modesService.getModes().subscribe((modes) => (this.modes = modes));
  }

  toggleEditorMode(): void {
    this.modes.editorMode = !this.modes.editorMode;
    this.setModes();
  }

  toggleFlowMode(): void {
    this.modes.flowMode = !this.modes.flowMode;
    this.setModes();
  }

  setModes(): void {
    this.modesService.setModes(this.modes);
  }
}
