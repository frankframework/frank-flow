import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateForwardComponent } from './create-forward.component';

describe('CreateForwardComponent', () => {
  let component: CreateForwardComponent;
  let fixture: ComponentFixture<CreateForwardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CreateForwardComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateForwardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
