import { TestBed } from '@angular/core/testing';
import { ToastrModule } from 'ngx-toastr';

import { NodeGeneratorService } from './node-generator.service';

describe('NodeGeneratorService', () => {
  let service: NodeGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToastrModule.forRoot()],
    });
    service = TestBed.inject(NodeGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
