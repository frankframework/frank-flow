import { TestBed } from '@angular/core/testing';

import { FrankDocService } from './frank-doc.service';

describe('FrankDocService', () => {
  let service: FrankDocService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FrankDocService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
