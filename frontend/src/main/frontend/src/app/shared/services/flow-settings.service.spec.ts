import { TestBed } from '@angular/core/testing';

import { FlowSettingsService } from './flow-settings.service';

describe('FlowSettingsService', () => {
  let service: FlowSettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FlowSettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
