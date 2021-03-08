import { TestBed } from '@angular/core/testing';

import { PaletteService } from './palette.service';
import { ToastrModule } from 'ngx-toastr';

describe('PaletteService', () => {
  let service: PaletteService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToastrModule.forRoot()],
    });
    service = TestBed.inject(PaletteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
