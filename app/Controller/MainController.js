import ConfigurationConverter from '../Model/ConfigurationConverter.js';
import CodeController from './CodeController.js';
import FlowController from './FlowController.js';
import PipeInfoController from './PipeInfoController';
import IbisdocModel from '../Model/IbisdocModel.js'
import FlowModel from '../Model/FlowModel.js';
import CodeFacade from '../Facade/CodeFacade.js';


class MainController {

  constructor() {
    this.configurationConverter = new ConfigurationConverter();
    this.ibisdocModel = new IbisdocModel();
    this.flowModel = new FlowModel();
    this.pipeInfoController = new PipeInfoController(this, this.ibisdocModel, this.flowModel);
    this.codeController = new CodeController(this, this.ibisdocModel);
    this.flowController = new FlowController(this, this.flowModel);
    this.codeFacade = new CodeFacade(this.codeController, this.pipeInfoController, this.flowController);

  }

  //_______________CRUD methods for the code view_______________

  modifyCode(type, obj) {
    return this.codeFacade.modifyCode(type, obj);
  }

  //_______________Generation of flow_______________

  convertConfiguration() {
    return this.configurationConverter.convertConfiguration(this.codeController.codeView.editor);
  }

  generateFlow() {
    this.flowController.flowView.modifyFlow("generate");
  }
  setPipes(data) {
    this.flowController.paletteView.generatePalettePipes(data[2].classes);
  }
}

let mainController = new MainController();


