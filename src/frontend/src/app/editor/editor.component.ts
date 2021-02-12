import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
})
export class EditorComponent implements OnInit {
  constructor() {}

  initCode = '<root></root>';
  // Either you can use the two-way binding and abstraction or
  // you can directly access the monaco-editor instance in your parent class.
  // @ViewChild('MonacoEditorComponent')
  // editorComponent: MonacoEditorComponent;

  ngOnInit(): void {}
}
