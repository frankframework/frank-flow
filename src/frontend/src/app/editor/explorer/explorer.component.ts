import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { jqxTreeComponent } from 'jqwidgets-ng/jqxtree';
import TreeOptions = jqwidgets.TreeOptions;

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss'],
})
export class ExplorerComponent implements AfterViewInit {
  @ViewChild('treeReference', { static: false }) tree!: jqxTreeComponent;
  searchTerm!: string;

  treeSource: any[] = [
    {
      label: 'Frank2Test',
      expanded: true,
      items: [
        { label: 'Test.xsd' },
        { label: 'Test2.xml', selected: true },
        { label: 'Test3.xml' },
        { label: 'Test4.xml' },
      ],
    },
    {
      label: 'TestConfig',
      expanded: true,
      items: [
        { label: 'Test.xsd' },
        { label: 'Test2.xml' },
        { label: 'Test3.xml' },
        { label: 'Test4.xml' },
      ],
    },
    { label: 'ibisdoc.xsd' },
  ];

  treeSettings: TreeOptions = {
    allowDrag: false,
    allowDrop: false,
  };

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.tree.setOptions(this.treeSettings);
    });
  }

  onItemClick(event: Event): void {
    console.log(event);
  }
}
