import { TestBed } from '@angular/core/testing';

import { PanZoomService } from './pan-zoom.service';

describe('PanZoomService', () => {
  let service: PanZoomService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PanZoomService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
