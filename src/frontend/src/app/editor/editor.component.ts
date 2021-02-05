import { Component, OnInit } from '@angular/core';
import {TreeviewConfig, TreeviewItem} from "ngx-treeview";

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements OnInit {
  editorOptions = {
    theme: 'vs-dark',
    language: 'xml'
  }
  code: string = '<root></root>'

  constructor() { }

  ngOnInit(): void {
  }

}
