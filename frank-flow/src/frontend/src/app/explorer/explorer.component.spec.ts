import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExplorerComponent } from './explorer.component';
import { jqxTreeModule } from 'jqwidgets-ng/jqxtree';
import { ToastrModule } from 'ngx-toastr';
import { NgxSmartModalModule } from 'ngx-smart-modal';

describe('ExplorerComponent', () => {
  let component: ExplorerComponent;
  let fixture: ComponentFixture<ExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExplorerComponent],
      imports: [
        ToastrModule.forRoot(),
        jqxTreeModule,
        NgxSmartModalModule.forRoot(),
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
