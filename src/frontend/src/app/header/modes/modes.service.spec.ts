import { TestBed } from '@angular/core/testing';

import { ModesService } from './modes.service';

describe('ModesService', () => {
  let service: ModesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ModesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
