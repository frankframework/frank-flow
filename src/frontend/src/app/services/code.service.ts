/// <reference path="../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CodeService {
  editor!: monaco.editor.IStandaloneCodeEditor;
  currentFile = `<Configuration name="dd">
	<Adapter name="ddAdapter"> 
		<Receiver name="ddReceiver" x="681" y="24"> 
			<JavaListener name="ddListener" serviceName="ddService" />
		</Receiver>
		<Pipeline firstPipe="ddPipe">
			<FixedResultPipe name="ddPipe" returnString="Hello World">
				<Forward name="success" path="EXIT"/> 
			</FixedResultPipe> 
			<Exit path="EXIT" state="success" x="223" y="425"/> 
		</Pipeline> 
	</Adapter>
</Configuration>
`;

  constructor() {}

  setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
  }

  getCurrentFile(): string {
    return this.currentFile;
  }
}
