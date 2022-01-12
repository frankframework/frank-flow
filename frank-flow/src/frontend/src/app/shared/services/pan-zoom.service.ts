import { Injectable } from '@angular/core';
import { PanZoomAPI, PanZoomConfig, PanZoomConfigOptions } from 'ngx-panzoom';

@Injectable({
  providedIn: 'root',
})
export class PanZoomService {
  private panZoomConfigOptions: PanZoomConfigOptions = {
    zoomLevels: 3,
    scalePerZoomLevel: 2,
    zoomStepDuration: 0.2,
    freeMouseWheel: false,
    invertMouseWheel: true,
    zoomToFitZoomLevelFactor: 1,
    dragMouseButton: 'left',
    zoomButtonIncrement: 0.1,
    zoomOnDoubleClick: false,
    dynamicContentDimensions: true,
    neutralZoomLevel: 1,
    initialZoomLevel: 1,
  };
  public panZoomConfig: PanZoomConfig = new PanZoomConfig(
    this.panZoomConfigOptions
  );
  public panZoomAPI!: PanZoomAPI;

  constructor() {
    this.setPanzoomApiSubscription();
  }

  setPanzoomApiSubscription(): void {
    this.panZoomConfig.api.subscribe(
      (api: PanZoomAPI) => (this.panZoomAPI = api)
    );
  }

  zoomIn(): void {
    this.panZoomAPI.zoomIn('viewCenter');
  }

  zoomOut(): void {
    this.panZoomAPI.zoomOut('viewCenter');
  }

  reset(): void {
    this.panZoomAPI.resetView();
  }

  panCenter(): void {
    this.panZoomAPI.centerContent();
  }
}
