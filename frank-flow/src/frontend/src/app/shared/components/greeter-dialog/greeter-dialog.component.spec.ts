import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSmartModalModule } from 'ngx-smart-modal';
import { ToastrModule } from 'ngx-toastr';

import { GreeterDialogComponent } from './greeter-dialog.component';

describe('GreeterDialogComponent', () => {
  let component: GreeterDialogComponent;
  let fixture: ComponentFixture<GreeterDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GreeterDialogComponent],
      imports: [NgxSmartModalModule.forRoot(), ToastrModule.forRoot()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GreeterDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
