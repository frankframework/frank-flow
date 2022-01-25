import { Component } from '@angular/core';
import { PanZoomService } from '../../shared/services/pan-zoom.service';
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faDotCircle,
  faHome,
  faSearchMinus,
  faSearchPlus,
} from '@fortawesome/free-solid-svg-icons';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-actions',
  templateUrl: './actions.component.html',
  styleUrls: ['./actions.component.scss'],
})
export class ActionsComponent {
  constructor(
    private library: FaIconLibrary,
    private panZoomService: PanZoomService
  ) {
    this.library.addIcons(
      faArrowDown,
      faArrowUp,
      faArrowRight,
      faArrowLeft,
      faSearchMinus,
      faSearchPlus,
      faHome,
      faDotCircle
    );
  }

  zoomIn(): void {
    this.panZoomService.zoomIn();
  }

  zoomOut(): void {
    this.panZoomService.zoomOut();
  }

  zoomReset(): void {
    this.panZoomService.reset();
  }
}
