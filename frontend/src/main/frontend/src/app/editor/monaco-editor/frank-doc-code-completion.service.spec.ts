import { TestBed } from '@angular/core/testing';

import { FrankDocCodeCompletionService } from './frank-doc-code-completion.service';

describe('FrankDocCodeCompletionService', () => {
  let service: FrankDocCodeCompletionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FrankDocCodeCompletionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
