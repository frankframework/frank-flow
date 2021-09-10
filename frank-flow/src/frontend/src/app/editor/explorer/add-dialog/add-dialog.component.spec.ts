import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSmartModalModule } from 'ngx-smart-modal';
import { ToastrModule } from 'ngx-toastr';

import { AddDialogComponent } from './add-dialog.component';

describe('AddDialogComponent', () => {
  let component: AddDialogComponent;
  let fixture: ComponentFixture<AddDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddDialogComponent],
      imports: [NgxSmartModalModule.forRoot(), ToastrModule.forRoot()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
