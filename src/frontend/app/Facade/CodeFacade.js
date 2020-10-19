export default class CodeFacade {
    constructor(codeController, pipeInfoController, flowController) {
        this.codeController = codeController;
        this.pipeInfoController = pipeInfoController;
        this.flowController = flowController;
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
            console.log("facade select: ", obj)
            this.pipeInfoController.selectPipe(this.flowController.flowView.flowGenerator.pipes[obj.name]);
            break;
          case "changePipeType":
            codeController.changePipeType(obj.name, obj.type, obj.oldType);
            break;
          case "getAttributes":
            return codeController.getAttributes(obj.name);
            break;
          case "getParameters":
            return codeController.getParameters(obj.name);
            break;
          case "changeAttribute":
            codeController.changeAttribute(obj.pipeName, obj.attribute, obj.attributeValue);
            break;
          case "addAttribute":
            codeController.addAttribute(obj.pipeName, obj.attribute);
            break
          case "deleteAttribute":
            codeController.deleteAttribute(obj.pipeName, obj.attribute);
            break;
          case "addParameter":
            codeController.addParameter(obj.pipeName, obj.paramName);
            break;
          case "deleteParameter":
            codeController.deleteParameter(obj.pipeName, obj.paramName);
            break;
          case "addParameterAttribute":
            codeController.addParameterAttribute(obj.pipeName, obj.paramName, obj.attributeName);
            break;
          case "changeParameterAttribute":
            codeController.changeParameterAttribute(obj.pipeName, obj.paramName, obj.attributeName, obj.value);   
            break;
        }
    }
}