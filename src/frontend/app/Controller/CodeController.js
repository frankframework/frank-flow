import CodeView from '../View/codeView/CodeView.js';

import XsdModel from '../Model/XsdModel';
import * as beautify from 'vkbeautify';
import XsdService from '../services/XsdService.js';
import IbisdocService from '../services/IbisdocService.js';
import FileModel from '../Model/FileModel.js';
import FileTreeController from './FileTreeController.js';

export default class CodeController {

  constructor(mainController, ibisdocModel) {
    this.mainController = mainController;

    this.xsdModel = new XsdModel();
    this.ibisdocModel = ibisdocModel;
    this.fileModel = new FileModel();

    this.codeView = new CodeView(this.xsdModel);
    this.fileModel.addListener(this)


    this.xsdService = new XsdService(this.xsdModel);
    this.ibisdocService = new IbisdocService(this.ibisdocModel, this.codeView);


    this.xsdService.getXsd();
    this.ibisdocService.getIbisdoc();

    this.codeView.makeEditor();
    this.editor = this.codeView.editor;

    this.fileTreeController = new FileTreeController(this.editor, this.xsdModel);

    this.initEventListeners();
  }


  //_______________Event handlers_______________

  initEventListeners() {
    let cur = this;

    $('#beautify').click(function () {
      let prettyXML = beautify.xml(cur.editor.getValue(), 4);
      cur.editor.getModel().setValue(prettyXML);
    });

    cur.editor.onMouseDown(function (e) {
      e.target.range.startLineNumber = 1;
      e.target.range.startColumn = 1;

      const textPossition = cur.editor.getModel().getValueInRange(e.target.range),
            adapters = textPossition.match(/<Adapter[^]*?name=".*?">/g);

      if (adapters != null) {
        let adapterName = adapters[adapters.length - 1].match(/name="[^]*?"/g)[0].match(/"[^]*?"/g)[0].replace(/"/g, '');

        if (localStorage.getItem("currentAdapter") !== adapterName) {
          localStorage.setItem("currentAdapter", adapterName);
          cur.quickGenerate();
        }
      }
    })


    this.editor.getModel().onDidChangeContent(cur.debounce(function () {
      cur.quickGenerate()
    }, 250))

  }

  //_______________Custom methods to be called from handlers_______________

  quickGenerate() {
    let cur = this;
    if (!cur.mainController.flowController.flowView.moving && !cur.mainController.flowController.flowView.adding) {
      try {
        $('#canvas').css('display', 'block');
        $('.customErrorMessage').remove();
        cur.mainController.generateFlow();
      } catch (error) {
        cur.mainController.flowController.flowView.modifyFlow("error", error);
      }
    }
  }

  debounce(func, wait, immediate) {
    var timeout;
    return function () {
      var context = this,
        args = arguments;
      var later = function () {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  };


  //_______________Methods for modifying the editor_______________

  setEditorValue(value) {
    this.codeView.setEditorValue(value);
  }

  selectPipe(name) {
    this.codeView.selectPipe(name);
  }
  getTypes() {
    return this.codeView.getTypes();
  }
  validateConfiguration() {
    return this.codeView.validateConfigurationView.validateConfiguration();
  }
  decorateLine(lineNumber) {
    this.codeView.validateConfigurationView.decorateLine(lineNumber);
  }
  undoDecorations() {
    this.codeView.validateConfigurationView.undoDecorations();
  }
  changeName(oldWord, newWord) {
    this.codeView.changeName(oldWord, newWord);
  }
  changePipeType(name, type, oldType) {
    this.codeView.changePipeType(name, type, oldType);
  }
  changePossition(name, newX, newY) {
    this.codeView.changePossition(name, newX, newY);
  }
  changeExitPossition(name, newX, newY) {
    this.codeView.changeExitPossition(name, newX, newY);
  }
  changeAddForward(name, path) {
    this.codeView.changeAddForward(name, path);
  }
  deleteForward(name, path) {
    this.codeView.deleteForward(name, path);
  }
  changeAddPipe(name, possitions, className) {
    this.codeView.changeAddPipe(name, possitions, className);
  }
  getPipes() {
    return this.codeView.ibisdocJson;
  }
  getAttributes(name) {
    return this.codeView.getAttributes(name);
  }
  getParameters(name) {
    return this.codeView.getParameters(name);
  }
  changeAttribute(pipeName, attribute, attributeValue) {
    this.codeView.changeAttribute(pipeName, attribute, attributeValue);
  }
  addAttribute(pipeName, attribute) {
    this.codeView.addAttribute(pipeName, attribute);
  }
  deleteAttribute(pipeName, attribute) {
    this.codeView.deleteAttribute(pipeName, attribute);
  }
  addParameter(pipeName, paramName) {
    this.codeView.addParameter(pipeName, paramName);
  }
  deleteParameter(pipeName, paramName) {
    this.codeView.deleteParameter(pipeName, paramName);
  }
  addParameterAttribute(pipeName, paramName, attribute) {
    this.codeView.addParameterAttribute(pipeName, paramName, attribute);
  }
  changeParameterAttribute(pipeName, paramName, attribute, value) {
    this.codeView.changeParameterAttribute(pipeName, paramName, attribute, value);
  }
  deletePipe() {
    this.codeView.codePipeView.deletePipe()
  }
}
