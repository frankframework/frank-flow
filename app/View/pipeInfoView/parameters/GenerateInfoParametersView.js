export default class GenerateInfoParametersView {
    generatePipeParameters(parameters) {
        if (parameters.length !== 0) {
          console.log(parameters)
          parameters.forEach((param, i) => {
            let parameterBox = $('<div></div>').addClass('parameterContent'),
              parameterToolbox = $('<div></div>').addClass('parameterToolbox'),
              text = $('<p></p>').text("name" + ': ' + param["name"]);
            parameterBox.append(text);
    
            let buttons = this.generatePipeParameterButtons(param);
            this.generatePipeParameterAttributes(param, parameterToolbox);
    
            parameterToolbox.append(buttons.addButton);
            parameterBox.append(buttons.deleteButton);
            $('#parametersInfo').append(parameterBox, parameterToolbox);
          });
        }
      }
    
      generatePipeParameterAttributes(param, parameterToolbox) {
        for (let attribute in param) {
          if (param["name"]) {
    
            let attrLabel = $('<label></label>').text(attribute + ': ').addClass('forwardInfo'),
              attrInput = $('<input></input>').attr({type: 'input', id: attribute}).val(param[attribute]),
              attrWrapper = $('<div></div>').addClass('paramAttributeWrapper').attr('name', param["name"]);
    
            attrWrapper.append(attrLabel, attrInput);
            parameterToolbox.append(attrWrapper);
          }
        }
      }
    
      generatePipeParameterButtons(param) {
        let deleteButton = $('<button></button>'),
        addButton = $('<i></i>');
    
      deleteButton.text('X').attr({
        id: 'parameterDelete',
        name: param["name"]
      })
      .addClass('paramDeleteButton')
    
      addButton.addClass("fas fa-plus-circle").attr({
        id: 'parameterAttributeAdd',
        name: param["name"]
      });
    
      return {deleteButton: deleteButton, addButton: addButton}
      }
}