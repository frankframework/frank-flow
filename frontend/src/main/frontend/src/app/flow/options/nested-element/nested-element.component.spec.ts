import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NestedElementComponent } from './nested-element.component';

describe('NestedElementComponent', () => {
  let component: NestedElementComponent;
  let fixture: ComponentFixture<NestedElementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NestedElementComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NestedElementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
