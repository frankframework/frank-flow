import ValidateConfigurationView from './ValidateConfigurationView.js';
import CodeCompletionView from './codeCompletion/CodeCompletionView.js';
import CodeEditView from './codeEditViews/CodeEditView.js';
import OptionView from './codeEditViews/OptionView.js';
import CodePipeView from './codeEditViews/CodePipeView.js';
import CodeTypesView from './codeEditViews/CodeTypesView.js';
import ExitPipeView from './codeEditViews/ExitPipeView.js';
import CodeAttributesView from './codeEditViews/CodeAttributesView.js';
import CodeParametersView from './codeEditViews/CodeParametersView.js';

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
    this.codeAttributesView = new CodeAttributesView(this.editor);
    this.codeParametersView = new CodeParametersView(this.editor);
  }

  //add options to the dropdown.
  addOptions(adapters) {
    this.optionView.addOptions(adapters);
  }

  //select a pipe.
  selectPipe(name) {
    this.codePipeView.selectPipe(name);
  }

  //change the type of a pipes
  changePipeType(name, type, oldType) {
    this.codePipeView.changePipeType(name, type, oldType);
  }

  //change the name.
  changeName(oldWord, newWord) {
    this.codePipeView.changeName(oldWord, newWord);
  }

  //change possition for pipes
  changePossition(name, newX, newY) {
    this.codePipeView.changePossition(name, newX, newY);
    // this.codeAttributesView.changeAttribute(name, 'x', newX);
    // this.codeAttributesView.changeAttribute(name, 'y', newY);
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

  getAttributes(name) {
    return this.codeAttributesView.getAttributes(name);
  }

  getParameters(name) {
    return this.codeParametersView.getParameters(name);
  }

  changeAttribute(pipeName, attribute, attributeValue) {
    this.codeAttributesView.changeAttribute(pipeName, attribute, attributeValue);
  }

  addAttribute(pipeName, attribute) {
    this.codeAttributesView.addAttribute(pipeName, attribute);
  }
  deleteAttribute(pipeName, attribute) {
    this.codeAttributesView.deleteAttribute(pipeName, attribute);
  }

  addParameter(pipeName, paramName) {
    this.codeParametersView.addParameter(pipeName, paramName);
  }

  deleteParameter(pipeName, paramName) {
    this.codeParametersView.deleteParameter(pipeName, paramName);
  }
}
