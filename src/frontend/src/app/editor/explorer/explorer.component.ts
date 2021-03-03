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
      icon: '../images/mailIcon.png',
      label: 'Mail',
      expanded: true,
      items: [
        { icon: '../images/calendarIcon.png', label: 'Calendar' },
        {
          icon: '../images/contactsIcon.png',
          label: 'Contacts',
          selected: true,
        },
      ],
    },
    {
      icon: '../images/folder.png',
      label: 'Inbox',
      expanded: true,
      items: [
        { icon: '../images/folder.png', label: 'Admin' },
        { icon: '../images/folder.png', label: 'Corporate' },
        { icon: '../images/folder.png', label: 'Finance' },
        { icon: '../images/folder.png', label: 'Other' },
      ],
    },
    { icon: '../images/recycle.png', label: 'Deleted Items' },
    { icon: '../images/notesIcon.png', label: 'Notes' },
    { iconsize: 14, icon: '../images/settings.png', label: 'Settings' },
    { icon: '../images/favorites.png', label: 'Favorites' },
  ];

  treeSettings: TreeOptions = {
    allowDrag: false,
    allowDrop: false,
  };

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.tree.selectItem(null);
      this.tree.setOptions(this.treeSettings);
    });
  }

  onItemClick(event: Event): void {
    console.log(event);
  }
}
