import { TestBed } from '@angular/core/testing';

import { CodeServiceService } from './code-service.service';

describe('CodeServiceService', () => {
  let service: CodeServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CodeServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
