import { TestBed } from '@angular/core/testing';

import { IbisDocService } from './ibis-doc.service';
import { ToastrModule } from 'ngx-toastr';

describe('IbisDocService', () => {
  let service: IbisDocService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToastrModule.forRoot()],
    });
    service = TestBed.inject(IbisDocService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
