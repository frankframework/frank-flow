import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModesComponent } from './modes.component';

describe('ModesComponent', () => {
  let component: ModesComponent;
  let fixture: ComponentFixture<ModesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModesComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
