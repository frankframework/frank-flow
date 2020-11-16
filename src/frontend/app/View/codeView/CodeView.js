import ValidateConfigurationView from './ValidateConfigurationView.js';
import CodeEditView from './codeEditViews/CodeEditView.js';
// import OptionView from './codeEditViews/OptionView.js';
import CodePipeView from './codeEditViews/CodePipeView.js';
import CodeTypesView from './codeEditViews/CodeTypesView.js';
import ExitPipeView from './codeEditViews/ExitPipeView.js';
import CodeAttributesView from './codeEditViews/CodeAttributesView.js';
import CodeParametersView from './codeEditViews/CodeParametersView.js';
import XSDCodeCompletionView from './codeCompletion/XSDCodeCompletionView.js';
import * as monaco from 'monaco-editor'

export const logColor = 'background: #222; color: #bada55';

export default class CodeView {

  constructor(xsdModel) {
    this.listeners = [];
    this.xsdModel = xsdModel;
    this.decorations = null;
    this.validateConfigurationView;
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

    this.setGlobalVariables()

    this.validateConfigurationView = new ValidateConfigurationView(this.editor, this.xsdModel);
    this.codeEditView = new CodeEditView(this.editor);
    this.codePipeView = new CodePipeView(this.editor);
//    this.optionView = new OptionView(this.editor);
    this.typesView = new CodeTypesView(this.editor);
    this.exitPipeView = new ExitPipeView(this.editor);
    this.codeAttributesView = new CodeAttributesView(this.editor);
    this.codeParametersView = new CodeParametersView(this.editor);
    this.CodeCompletionView = new XSDCodeCompletionView(monaco, this.xsdModel);
  }

  setGlobalVariables() {
    window.PIPESREGEX = function(name) {
      return '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^>]*?name="' + name + '"[^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>';
    }
  }

  // addOptions(adapters) {
  //   this.optionView.addOptions(adapters);
  // }

  setEditorValue(value) {
    this.editor.setValue(value);
  }

  selectPipe(name) {
    this.codePipeView.selectPipe(name);
  }

  changePipeType(name, type, oldType) {
    this.codePipeView.changePipeType(name, type, oldType);
  }

  changeName(oldWord, newWord) {
    this.codePipeView.changeName(oldWord, newWord);
  }

  changePossition(name, newX, newY) {
    this.codePipeView.changePossition(name, newX, newY);
    // this.codeAttributesView.changeAttribute(name, 'x', newX);
    // this.codeAttributesView.changeAttribute(name, 'y', newY);
  }

  changeExitPossition(name, newX, newY) {
    this.exitPipeView.changeExitPossition(name, newX, newY);
  }

  changeAddForward(name, path) {
    this.codePipeView.changeAddForward(name, path);
  }

  deleteForward(name, path) {
    this.codePipeView.deleteForward(name, path);
  }

  changeAddPipe(name, possitions, className = "customPipe") {
    this.codePipeView.changeAddPipe(name, possitions, className);
  }

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

  addParameterAttribute(pipeName, paramName, attribute) {
    this.codeParametersView.addParameterAttribute(pipeName, paramName, attribute);
  }

  changeParameterAttribute(pipeName, paramName, attribute, value) {
    this.codeParametersView.changeParameterAttribute(pipeName, paramName, attribute, value);
  }
}