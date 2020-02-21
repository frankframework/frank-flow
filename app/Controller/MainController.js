import ConfigurationConverter from '../Model/ConfigurationConverter.js';
import CodeController from './CodeController.js';
import FlowController from './FlowController.js';
import PipeInfoController from './PipeInfoController';
import IbisdocModel from '../Model/IbisdocModel.js'


class MainController {

  constructor() {
    this.configurationConverter = new ConfigurationConverter();
    this.ibisdocModel = new IbisdocModel();
    this.pipeInfoController = new PipeInfoController(this, this.ibisdocModel);
    this.codeController = new CodeController(this, this.ibisdocModel);
    this.flowController = new FlowController(this);
  }

  convertConfiguration() {
    return this.configurationConverter.convertConfiguration(this.codeController.codeView.editor);
  }

  generateFlow() {
    this.flowController.flowView.modifyFlow("generate");
  }
  setPipes(data) {
    this.flowController.paletteView.generatePalettePipes(data[2].classes);
  }

  modifyCode(type, obj) {
    let codeController = this.codeController;
    switch (type) {
      case "getTypes":
        return codeController.getTypes();
        break;
      case "validateConfiguration":
        return codeController.validateConfiguration();
        break;
      case "decorateLine":
        codeController.decorateLine(obj.line);
        break;
      case "undoDecorations":
        codeController.undoDecorations();
        break;
      case "changeName":
        codeController.changeName(obj.oldName, obj.newName);
        break;
      case "changePossition":
        codeController.changePossition(obj.name, obj.x, obj.y);
        break;
      case "changeExitPossition":
        codeController.changeExitPossition(obj.name, obj.x, obj.y);
        break;
      case "changeAddForward":
        codeController.changeAddForward(obj.source, obj.target);
        break;
      case "deleteForward":
        codeController.deleteForward(obj.name, obj.target);
        break;
      case "changeAddPipe":
        codeController.changeAddPipe(obj.name, obj.possitions, obj.className);
        break;
      case "selectPipe":
        codeController.selectPipe(obj.name);
        this.pipeInfoController.selectPipe(obj.name, obj.type);
        break;
      case "changePipeType":
        console.log(obj.name)
        codeController.changePipeType(obj.name, obj.type, obj.oldType);
        break;
    }
  }
}

let mainController = new MainController();
