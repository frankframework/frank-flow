import { Injectable } from '@angular/core';
import { PanZoomAPI, PanZoomConfig, PanZoomConfigOptions } from 'ngx-panzoom';

@Injectable({
  providedIn: 'root',
})
export class PanZoomService {
  private panZoomConfigOptions: PanZoomConfigOptions = {
    zoomLevels: 5,
    scalePerZoomLevel: 2,
    zoomStepDuration: 0.2,
    freeMouseWheel: false,
    invertMouseWheel: true,
    zoomToFitZoomLevelFactor: 1,
    dragMouseButton: 'left',
    zoomButtonIncrement: 0.4,
    zoomOnDoubleClick: false,
    dynamicContentDimensions: true,
    neutralZoomLevel: 3,
    initialZoomLevel: 3,
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
    this.panZoomAPI.resetView?.();
  }

  panCenter(): void {
    this.panZoomAPI.centerContent();
  }

  panTo(x: number, y: number): void {
    this.panZoomAPI.panToPoint({ x, y });
  }

  zoom(zoomLevel: number): void {
    this.panZoomAPI.changeZoomLevel(zoomLevel, { x: 0, y: 0 });
  }
}
