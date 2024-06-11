import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlowSettingsComponent } from './flow-settings.component';
import { NgxSmartModalComponent, NgxSmartModalModule } from 'ngx-smart-modal';

describe('FlowSettingsComponent', () => {
  let component: FlowSettingsComponent;
  let fixture: ComponentFixture<FlowSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FlowSettingsComponent, NgxSmartModalComponent],
      imports: [NgxSmartModalModule.forChild()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FlowSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
