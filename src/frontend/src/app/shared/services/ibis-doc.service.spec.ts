import { TestBed } from '@angular/core/testing';

import { IbisDocService } from './ibis-doc.service';

describe('IbisDocService', () => {
  let service: IbisDocService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IbisDocService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
