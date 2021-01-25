import PipeInfoView from '../View/pipeInfoView/PipeInfoView.js';

export default class PipeInfoController {

  constructor(mainController, ibisdocModel, flowModel) {
    this.ibisdocModel = ibisdocModel;
    this.mainController = mainController;
    this.pipeInfoView = new PipeInfoView(flowModel);
    this.ibisdocModel.addListener(this);
    this.setEventListeners();
  }

  notify(data) {
    this.pipeInfoView.generateTypes(data);
  }

  selectPipe(pipe) {
    this.oldName = pipe.name;
    this.oldType = pipe.type;
    this.pipeInfoView.setPipeName(pipe.name);
    this.pipeInfoView.setPipeType(pipe.type);
    let attributes = this.mainController.modifyCode("getAttributes", {
        name: pipe.name
      }),
      parameters = this.mainController.modifyCode("getParameters", {
        name: pipe.name
      });
    this.pipeInfoView.generatePipeAttributes(attributes);
    this.pipeInfoView.generatePipeParameters(parameters);
    this.setEventListeners();
  }

  //_______________CRUD methods_______________

  changeName(oldName, newName) {
    this.mainController.modifyCode("changeName", {
      oldName: oldName,
      newName: newName
    })
    this.oldName = newName;
  }

  changeType(type) {
    let cur = this;
    this.mainController.modifyCode("changePipeType", {
      name: cur.oldName,
      type: type,
      oldType: cur.oldType
    })
    this.oldType = type;
  }

  addAttribute(attribute) {
    let cur = this
    this.mainController.modifyCode("addAttribute", {
      pipeName: cur.oldName,
      attribute: attribute
    });
    this.mainController.modifyCode("selectPipe", {name: cur.oldName});
  }

  changeAttribute(attribute, attributeValue) {
    let cur = this;
    this.mainController.modifyCode('changeAttribute', {
      pipeName: cur.oldName,
      attribute: attribute,
      attributeValue: attributeValue
    })
  }

  deleteAttribute(attribute) {
    let cur = this;
    this.mainController.modifyCode('deleteAttribute', {
      pipeName: cur.oldName,
      attribute: attribute
    });
    this.mainController.modifyCode("selectPipe", {name: cur.oldName});
  }

  addParameter(parameter) {
    let cur = this;
    this.mainController.modifyCode('addParameter', {
      pipeName: cur.oldName,
      paramName: parameter
    })
    this.mainController.modifyCode("selectPipe", {name: cur.oldName});
  }

  deleteParameter(parameter) {
    let cur = this;
    this.mainController.modifyCode('deleteParameter', {
      pipeName: cur.oldName,
      paramName: parameter
    })
    this.mainController.modifyCode("selectPipe", {name: cur.oldName});
  }

  addParameterAttribute(parameter, attribute) {
    let cur = this;
    this.mainController.modifyCode('addParameterAttribute',
      {
        pipeName: cur.oldName,
        paramName: parameter,
        attributeName: attribute
      }
    )
    this.mainController.modifyCode("selectPipe", {name: cur.oldName});
  }


  changeParameterAttribute(parameter, attribute, value) {
    let cur = this;
    this.mainController.modifyCode('changeParameterAttribute', {
      pipeName: cur.oldName,
      paramName: parameter,
      attributeName: attribute,
      value: value
    })
  }

  //_______________event listeners_______________

  setEventListeners() {
    let cur = this;

    $('#pipeInfoName').on('change', function() {
      let newName = $(this).val();
      cur.pipeInfoView.setPipeName(newName);
      cur.changeName(cur.oldName, newName);
    });

    $('#typeSelect').on('change', function() {
      let type = $(this).val()
      cur.pipeInfoView.setPipeType(type);
      cur.changeType(type);
    });

    //_______________Attributes_______________

    $('#attributesInfo input').on('change', function(e) {
      let attributeValue = $(e.currentTarget).val(),
      attribute = $(e.currentTarget).attr('name');

      cur.changeAttribute(attribute, attributeValue);
    })
    $('#addAttribute').off('click').on('click', function(e) {
      let attributeName = prompt("new Attribute for " + cur.oldName + ':', 'attribute name');
      if(attributeName != null) {
      cur.addAttribute(attributeName);
      }
    })

    $('#attributesInfo .attributeWrapper button').on('click', function(e) {
      let attribute = $(e.currentTarget).attr('name');
      cur.deleteAttribute(attribute);
    });

    //_______________Parameters_______________

    $('.parameterContent').on('click', function(e) {
      let toolbox = e.currentTarget.nextElementSibling;
      if ($(toolbox).css('display') === 'none') {
        $(toolbox).css('display', 'block')
      } else {
        $(toolbox).css('display', 'none')
      }
    });

    $('#addParameter').off('click').on('click', function(e) {
      let parameterName = prompt("new parameter for " + cur.oldName + ':', 'parameter name');
      if(parameterName != null) {
        cur.addParameter(parameterName);
      }
    })
    $('#parametersInfo #parameterDelete').on('click', function(e) {
      let parameterName = $(this).attr('name');
      cur.deleteParameter(parameterName);
    })

    $('#parametersInfo .parameterToolbox i').on('click', function() {
      let parameterName = $(this).attr('name'),
      attributeName = prompt("name new attribute");
      attributeName = attributeName.replace(/\s/g, '');
      cur.addParameterAttribute(parameterName, attributeName);
    })

    $('#parametersInfo .paramAttributeWrapper input').on('change', function(e) {
      let parameterName = $(this.parentElement).attr('name'),
      attributeName = $(this).attr('id'),
      value = $(this).val();
      cur.changeParameterAttribute(parameterName, attributeName, value);
    })
  }
}
