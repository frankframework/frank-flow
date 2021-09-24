import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaletteComponent } from './palette.component';
import { ToastrModule } from 'ngx-toastr';
import { FilterPipe } from './filter.pipe';

describe('PaletteComponent', () => {
  let component: PaletteComponent;
  let fixture: ComponentFixture<PaletteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaletteComponent, FilterPipe],
      imports: [ToastrModule.forRoot()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PaletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
