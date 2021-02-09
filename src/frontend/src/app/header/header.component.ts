import { Component, OnInit } from '@angular/core';
import {
  faCode,
  faFile,
  faFolder,
  faProjectDiagram,
  faSave,
} from '@fortawesome/free-solid-svg-icons';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  constructor(library: FaIconLibrary) {
    library.addIcons(faFile, faFolder, faSave, faCode, faProjectDiagram);
  }

  ngOnInit(): void {}
}
