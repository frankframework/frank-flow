import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NodeComponent } from './node.component';
import { Node } from './node';
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
    component.node = { id: 'TestNode', top: 0, left: 20 } as Node;
    fixture.elementRef.nativeElement.id = component.node.id;
    component.jsPlumbInstance = jsPlumb.getInstance();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
