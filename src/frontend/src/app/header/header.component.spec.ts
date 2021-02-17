import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastContainerModule, ToastrModule } from 'ngx-toastr';
import { HeaderComponent } from './header.component';
import { NgxSmartModalComponent, NgxSmartModalModule } from 'ngx-smart-modal';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HeaderComponent, NgxSmartModalComponent],
      imports: [
        ToastrModule.forRoot(),
        ToastContainerModule,
        NgxSmartModalModule.forChild(),
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
