import { TestBed } from '@angular/core/testing';

import { FrankDocService as FrankDocumentService } from './frank-doc.service';

describe('FrankDocService', () => {
  let service: FrankDocumentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FrankDocumentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
