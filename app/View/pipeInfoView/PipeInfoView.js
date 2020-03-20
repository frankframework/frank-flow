export default class PipeInfoView {

  constructor(flowModel) {
    this.flowModel = flowModel;
    this.pipeName = "FixedResult";
    this.pipeType = "CheckEmptyMessage";
    this.setPipeName(this.pipeName);
    this.generatePipeForwards();
  }

  setPipeName(name) {
    this.pipeName = name;
    $('#pipeInfoName').val(name);
    this.refreshInfo();
  }

  setPipeType(type) {
    this.pipeType = type;
    $('#typeSelect').val(type);
    this.refreshInfo();
  }

  refreshInfo() {
    $('#pipeInfoTitleName').text(this.pipeName);
    $('#pipeInfoTitleType').text(this.pipeType);
    $('.forwardInfo').remove();
    $('.attributeWrapper').remove();
    $('.parameterContent').remove();
    $('.parameterToolbox').remove();
    this.generatePipeForwards();
  }

  //generate <p> tags for all forwards in a pipe.
  generatePipeForwards() {
    let cur = this;
    this.flowModel.getForwards().forEach(function(item, index) {
      if (item.sourcePipe == cur.pipeName) {
        $('#forwardsInfo').append($('<p></p>').text(item.targetPipe + ' - ' + item.name).addClass('forwardInfo'));
      }
    })
  }

  generatePipeAttributes(attributes) {
    if (attributes.x && attributes.y) {
      delete attributes.x;
      delete attributes.y;
    }
    for (let key in attributes) {
      if (key != "name") {
        let attrWrapper = $('<div></div>').addClass('attributeWrapper'),
          attrLabel = $('<label></label>').text(key + ': ').addClass('forwardInfo'),
          deleteButton = $('<button></button>').text('Delete').attr({
            id: 'attributeDelete',
            name: key
          })
          .addClass('deleteButton'),
          attrInput = $('<input></input>').attr({
            type: 'input',
            name: key
          }).val(attributes[key]);

        attrWrapper.append(attrLabel, attrInput, deleteButton);
        $('#attributesInfo').append(attrWrapper);
      }
    }
  }

  generatePipeParameters(parameters) {
    if (parameters.length !== 0) {
      console.log(parameters)
      parameters.forEach((item, i) => {
        let parameterBox = $('<div></div>').addClass('parameterContent'),
          parameterToolbox = $('<div></div>').addClass('parameterToolbox'),
          text = $('<p></p>').text("name" + ': ' + item["name"]);
        parameterBox.append(text);


        let deleteButton = $('<button></button>').text('X').attr({
            id: 'parameterDelete',
            name: item["name"]
          })
          .addClass('paramDeleteButton'),
            addButton = $('<i></i>').addClass("fas fa-plus-circle");

        for (let key in item) {
          if (item["name"]) {

            let attrLabel = $('<label></label>').text(key + ': ').addClass('forwardInfo'),
              attrInput = $('<input></input>').attr('type', 'input').val(item[key]),
              attrWrapper = $('<div></div>').addClass('paramAttributeWrapper')

            attrWrapper.append(attrLabel, attrInput);
            parameterToolbox.append(attrWrapper);
          }
        }
        parameterToolbox.append(addButton);
        parameterBox.append(deleteButton)
        $('#parametersInfo').append(parameterBox, parameterToolbox);
      });

    }
  }

  generateTypes(data) {
    let option;
    data[2].classes.forEach(function(item, index) {
      option = $('<option></option>').attr('value', item.name).text(item.name);
      $('#typeSelect').append(option);
    })
  }
}
