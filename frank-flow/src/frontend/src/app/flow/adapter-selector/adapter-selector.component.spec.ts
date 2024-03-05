import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdapterSelectorComponent } from './adapter-selector.component';

describe('ActionsComponent', () => {
  let component: AdapterSelectorComponent;
  let fixture: ComponentFixture<AdapterSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdapterSelectorComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdapterSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
