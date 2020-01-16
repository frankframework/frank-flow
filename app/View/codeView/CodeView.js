import ValidateConfigurationView from './ValidateConfigurationView.js';
import CodeCompletionView from './codeCompletion/CodeCompletionView.js';
import CodeEditView from './codeEditViews/CodeEditView.js';
import OptionView from './codeEditViews/OptionView.js';
import CodePipeView from './codeEditViews/CodePipeView.js';
import CodeTypesView from './codeEditViews/CodeTypesView.js';
import ExitPipeView from './codeEditViews/ExitPipeView.js';

export const logColor = 'background: #222; color: #bada55';

export default class CodeView {

  constructor() {
    this.listeners = [];
    this.ibisdocJson = null;
    this.decorations = null;
    this.decorations = null;
    this.validateConfigurationView;
    this.CodeCompletionView = new CodeCompletionView(this);
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(data) {
    this.listeners.forEach(l => l.notify(data));
  }

  //make the editor.
  makeEditor(adapter) {
    this.editor = monaco.editor.create(document.getElementById('monacoContainer'), {
      value: adapter,
      language: 'xml',
      theme: "vs-dark",
      glyphMargin: true,
      automaticLayout: true,
      verticalScrollbarSize: 17,
      horizontalScrollbarSize: 17,
      arrowSize: 30

    });
    this.validateConfigurationView = new ValidateConfigurationView(this.editor);
    this.codeEditView = new CodeEditView(this.editor);
    this.codePipeView = new CodePipeView(this.editor);
    this.optionView = new OptionView(this.editor);
    this.typesView = new CodeTypesView(this.editor);
    this.exitPipeView = new ExitPipeView(this.editor);
  }

  //add options to the dropdown.
  addOptions(adapters) {
    this.optionView.addOptions(adapters);
  }

  //select a pipe.
  selectPipe(name) {
    this.codePipeView.selectPipe(name);
  }

  //change the name.
  changeName(oldWord, newWord) {
    console.log("code view change name");
    this.codePipeView.changeName(oldWord, newWord);
  }

  //change possition for pipes
  changePossition(name, newX, newY) {
    this.codePipeView.changePossition(name, newX, newY);
  }

  //change the possitions for the exits
  changeExitPossition(name, newX, newY) {
    this.exitPipeView.changeExitPossition(name, newX, newY);
  }

  //add a forward
  changeAddForward(name, path) {
    this.codePipeView.changeAddForward(name, path);
  }

  //delete a forward to an pipe.
  deleteForward(name, path) {
    this.codePipeView.deleteForward(name, path);
  }

  // a method to add a pipe by hand.
  changeAddPipe(name, possitions, className = "customPipe") {
    this.codePipeView.changeAddPipe(name, possitions, className);
  }

  //gives back the types of pipes with the name of the pipe.
  getTypes() {
    return this.typesView.getTypes();
  }
}
