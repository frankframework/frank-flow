import { TestBed } from '@angular/core/testing';
import { IndividualConfig, ToastrModule, ToastrService } from 'ngx-toastr';

import { IbisDocService } from './ibis-doc.service';

const toastrConfig = {
  positionClass: 'toast-bottom-right',
  progressBar: true,
  extendedTimeOut: 2000,
  maxOpened: 10,
  autoDismiss: true,
  preventDuplicates: true,
  countDuplicates: true,
  resetTimeoutOnDuplicate: true,
  includeTitleDuplicates: true,
};

describe('IbisDocService', () => {
  let service: IbisDocService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IbisDocService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

const toastrService = {
  success: (
    message?: string,
    title?: string,
    override?: Partial<IndividualConfig>
  ) => {},
  error: (
    message?: string,
    title?: string,
    override?: Partial<IndividualConfig>
  ) => {},
};
