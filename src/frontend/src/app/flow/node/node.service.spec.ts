import { TestBed } from '@angular/core/testing';

import { NodeService } from './node.service';
import { NgxSmartModalModule } from 'ngx-smart-modal';

describe('NodeService', () => {
  let service: NodeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NodeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
