import { TestBed } from '@angular/core/testing';
import { ToastrModule } from 'ngx-toastr';

import { CodeService } from './code.service';

describe('CodeService', () => {
  let service: CodeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToastrModule.forRoot()],
    });
    service = TestBed.inject(CodeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
