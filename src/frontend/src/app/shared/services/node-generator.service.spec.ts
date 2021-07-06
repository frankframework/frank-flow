import { TestBed } from '@angular/core/testing';

import { NodeGeneratorService } from './node-generator.service';

describe('NodeGeneratorService', () => {
  let service: NodeGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NodeGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
