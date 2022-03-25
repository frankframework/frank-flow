import { TestBed } from '@angular/core/testing';

import { FlowNamespaceService } from './flow-namespace.service';

describe('FlowNamespaceService', () => {
  let service: FlowNamespaceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FlowNamespaceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
