import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModeComponent } from './mode.component';

describe('ModesComponent', () => {
  let component: ModeComponent;
  let fixture: ComponentFixture<ModeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModeComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
