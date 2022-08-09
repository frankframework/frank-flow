import { TestBed } from '@angular/core/testing';

import { FrankDoc as FrankDoc } from './frank-doc.service';

describe('FrankDocService', () => {
  let service: FrankDoc;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FrankDoc);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
