import { Component, OnInit } from '@angular/core';
import { PaletteService } from './palette.service';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss'],
})
export class PaletteComponent {
  search!: string;

  constructor(public paletteService: PaletteService) {}
}
