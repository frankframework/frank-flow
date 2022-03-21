import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigurationSettingsComponent } from './configuration-settings.component';
import { NgxSmartModalComponent, NgxSmartModalModule } from 'ngx-smart-modal';

describe('SettingsComponent', () => {
  let component: ConfigurationSettingsComponent;
  let fixture: ComponentFixture<ConfigurationSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfigurationSettingsComponent, NgxSmartModalComponent],
      imports: [NgxSmartModalModule.forChild()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ConfigurationSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
