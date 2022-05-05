import { Component, NgZone } from '@angular/core';
import { PanZoomService } from '../../shared/services/pan-zoom.service';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-actions',
  templateUrl: './actions.component.html',
  styleUrls: ['./actions.component.scss'],
})
export class ActionsComponent {
  public zoomLevel!: number;

  private manualZoom = false;

  constructor(
    private library: FaIconLibrary,
    private panZoomService: PanZoomService,
    private ngZone: NgZone
  ) {
    this.library.addIcons(faSearch);
  }

  ngOnInit() {
    this.subscribeToPanZoomModel();
  }

  subscribeToPanZoomModel() {
    this.panZoomService.panZoomConfig.modelChanged.subscribe({
      next: (model) => {
        if (!this.manualZoom) {
          this.ngZone.run(() => {
            this.zoomLevel = model.zoomLevel;
          });
        }
      },
    });
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

  zoom(): void {
    this.panZoomService.zoom(this.zoomLevel);
    this.manualZoom = true;
    setTimeout(() => {
      this.manualZoom = false;
    }, 200);
  }
}
