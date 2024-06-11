import { TestBed } from '@angular/core/testing';
import { ToastrModule } from 'ngx-toastr';

import { CurrentFileService } from './current-file.service';

describe('CurrentFileService', () => {
  let service: CurrentFileService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToastrModule.forRoot()],
    });
    service = TestBed.inject(CurrentFileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
