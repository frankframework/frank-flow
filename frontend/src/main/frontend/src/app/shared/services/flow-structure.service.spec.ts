import { TestBed } from '@angular/core/testing';
import { ToastrModule } from 'ngx-toastr';

import { FlowStructureService } from './flow-structure.service';

describe('FlowStructureService', () => {
  let service: FlowStructureService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToastrModule.forRoot()],
    });
    service = TestBed.inject(FlowStructureService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
