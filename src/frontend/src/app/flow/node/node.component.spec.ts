import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NodeComponent } from './node.component';
import { Node } from './nodes/node';
import Pipe from './nodes/pipe';
import { jsPlumb } from 'jsplumb';
import { NgxSmartModalModule } from 'ngx-smart-modal';

describe('NodeComponent', () => {
  let component: NodeComponent;
  let fixture: ComponentFixture<NodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NodeComponent],
      imports: [NgxSmartModalModule.forChild()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NodeComponent);
    component = fixture.componentInstance;

    component.node = new Pipe('TestPipe', undefined, 20, 20);
    fixture.elementRef.nativeElement.id = component.node.getId();
    component.jsPlumbInstance = jsPlumb.getInstance();

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
