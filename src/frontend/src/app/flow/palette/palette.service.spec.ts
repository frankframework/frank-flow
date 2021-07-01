import { TestBed } from '@angular/core/testing';

import { PaletteService } from './palette.service';

describe('PaletteService', () => {
  let service: PaletteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PaletteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
