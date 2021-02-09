import { Component, OnInit } from '@angular/core';
import { Modes } from './header/modes/modes';
import { ModesService } from './header/modes/modes.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  modes!: Modes;

  constructor(private modesService: ModesService) {}

  ngOnInit(): void {
    this.getModes();
  }

  getModes(): void {
    this.modesService.getModes().subscribe((modes) => (this.modes = modes));
    console.log(this.modes);
  }
}
