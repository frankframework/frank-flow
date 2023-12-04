import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileTreeIconComponent } from './file-tree-icon.component';

describe('FileTreeIconComponent', () => {
  let component: FileTreeIconComponent;
  let fixture: ComponentFixture<FileTreeIconComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FileTreeIconComponent],
    });
    fixture = TestBed.createComponent(FileTreeIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
