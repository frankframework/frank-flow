import { TestBed } from '@angular/core/testing';

import { FrankDocumentService as FrankDocumentService } from './frank-document.service';

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
