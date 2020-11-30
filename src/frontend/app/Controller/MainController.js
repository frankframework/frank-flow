import ConfigurationConverter from '../Converter/ConfigurationConverter.js';
import CodeController from './CodeController.js';
import FlowController from './FlowController.js';
import PipeInfoController from './PipeInfoController.js';
import PageController from './PageController.js';
import IbisdocModel from '../Model/IbisdocModel.js'
import FlowModel from '../Model/FlowModel.js';
import CodeFacade from '../Facade/CodeFacade.js';

import '../../css/bundle.css';

class MainController {

  constructor() {

    localStorage.clear();

    this.configurationConverter = new ConfigurationConverter();
    this.ibisdocModel = new IbisdocModel();
    this.flowModel = new FlowModel();
    this.pipeInfoController = new PipeInfoController(this, this.ibisdocModel, this.flowModel);
    this.codeController = new CodeController(this, this.ibisdocModel);
    this.flowController = new FlowController(this, this.flowModel, this.ibisdocModel);
    this.codeFacade = new CodeFacade(this.codeController, this.pipeInfoController, this.flowController);
    this.PageController = new PageController();

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
}

let mainController = new MainController();


