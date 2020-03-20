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


  //call this method to set name and type in variables and in the view.
  selectPipe(name, type) {
    this.oldName = name;
    this.oldType = type;
    this.pipeInfoView.setPipeName(name);
    this.pipeInfoView.setPipeType(type);
    let attributes = this.mainController.modifyCode("getAttributes", {
        name: name
      }),
      parameters = this.mainController.modifyCode("getParameters", {
        name: name
      });
    this.pipeInfoView.generatePipeAttributes(attributes);
    this.pipeInfoView.generatePipeParameters(parameters);
    this.setEventListeners();
  }

  //change the name in the configuration and set the previous name to the new name.
  changeName(oldName, newName) {
    this.mainController.modifyCode("changeName", {
      oldName: oldName,
      newName: newName
    })
    this.oldName = newName;
  }

  //change the type in the configuration and update the previous name to the new name.
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
    this.selectPipe(this.oldName, this.oldType);
  }

  changeAttribute(attribute, attributeValue) {
    let cur = this;
    this.mainController.modifyCode('changeAttribute', {
      pipeName: cur.oldName,
      attribute: attribute,
      attributeValue: attributeValue
    })
    this.selectPipe(this.oldName, this.oldType);
  }

  deleteAttribute(attribute) {
    let cur = this;
    this.mainController.modifyCode('deleteAttribute', {
      pipeName: cur.oldName,
      attribute: attribute
    });
    this.selectPipe(this.oldName, this.oldType);
  }

  addParameter(parameter) {
    let cur = this;
    this.mainController.modifyCode('addParameter', {
      pipeName: cur.oldName,
      paramName: parameter
    })
    this.selectPipe(this.oldName, this.oldType);
  }

  deleteParameter(parameter) {
    let cur = this;
    this.mainController.modifyCode('deleteParameter', {
      pipeName: cur.oldName,
      paramName: parameter
    })
    this.selectPipe(this.oldName, this.oldType);
  }

  //set the event listeners for the pipeinfo view.
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

    $('.parameterContent').on('click', function(e) {
      let toolbox = e.currentTarget.nextElementSibling;
      if ($(toolbox).css('display') == 'none') {
        $(toolbox).css('display', 'block')
      } else {
        $(toolbox).css('display', 'none')
      }
    });

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

    $('#addParameter').off('click').on('click', function(e) {
      let parameterName = prompt("new parameter for " + cur.oldName + ':', 'parameter name');
      if(parameterName != null) {
        cur.addParameter(parameterName);
      }
    })
    $('#parametersInfo .parameterContent button').on('click', function(e) {
      let parameterName = $(this).attr('name');
      console.log(parameterName)
      cur.deleteParameter(parameterName);
    })

    $('#parametersInfo .paramAttributeWrapper input').on('click', function(e) {
      console.log($(this).val());
    })

    $('#parametersInfo .paramAttributeWrapper input').on('change', function(e) {
      console.log($(this).val());
    })
  }
}
