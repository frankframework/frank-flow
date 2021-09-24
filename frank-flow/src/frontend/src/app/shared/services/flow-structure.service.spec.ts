import { TestBed } from '@angular/core/testing';

import { FlowStructureService } from './flow-structure.service';

describe('FlowStructureService', () => {
  let service: FlowStructureService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FlowStructureService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
