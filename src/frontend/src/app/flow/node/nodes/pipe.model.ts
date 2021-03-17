import { ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { jsPlumbInstance } from 'jsplumb';
import { NodeComponent } from '../node.component';
import { NodeModel } from './node.model';

export default class PipeModel extends NodeModel {
  generateNode(
    rootViewContainer: ViewContainerRef,
    factoryResolver: ComponentFactoryResolver,
    plumbInstance: jsPlumbInstance
  ): void {
    plumbInstance.ready(() => {
      const factory = factoryResolver.resolveComponentFactory(NodeComponent);
      const component = factory.create(rootViewContainer.injector);

      (component.instance as any).node = this;
      (component.instance as any).jsPlumbInstance = plumbInstance;

      const style = `left: ${this.getLeft()}px; top: ${this.getTop()}px;`;
      component.instance.style = style;
      component.location.nativeElement.id = this.getId();

      rootViewContainer.insert(component.hostView);
    });
  }
}
