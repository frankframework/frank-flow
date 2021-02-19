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
			<FixedResultPipe name="ddPipe" returnString="Hello World" x="681" y="224">
				<Forward name="success" path="EXIT"/> 
			</FixedResultPipe>
      <FixedResultPipe name="otherPipe" returnString="Hello World">
        <Forward name="success" path="EXIT"/> 
      </FixedResultPipe> 
      <XmlSwitchPipe name="switchXML"  x="381" y="224">
        <Forward name="success" path="EXIT"/>
        <Forward name="error" path="err"/>
      </XmlSwitchPipe>
			<Exit path="EXIT" state="success" x="223" y="425"/> 
		</Pipeline> 
	</Adapter>
</Configuration>
`;

  constructor() {}

  setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
    editor.setValue(this.currentFile);
  }

  setChangeListener(): void {}

  getCurrentFile(): string {
    return this.currentFile;
  }
}
