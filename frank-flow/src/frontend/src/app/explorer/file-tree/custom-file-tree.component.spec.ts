import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomFileTreeComponent } from './custom-file-tree.component';

describe('FileTreeComponent', () => {
  let component: CustomFileTreeComponent;
  let fixture: ComponentFixture<CustomFileTreeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CustomFileTreeComponent],
    });
    fixture = TestBed.createComponent(CustomFileTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
