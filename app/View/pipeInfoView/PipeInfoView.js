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
    for (let key in attributes) {
      let attrWrapper = $('<div></div>').addClass('attributeWrapper'),
        attrLabel = $('<label></label>').text(key + ': ').addClass('forwardInfo'),
        attrInput = $('<input></input>').attr('type', 'input').val(attributes[key]);

      attrWrapper.append(attrLabel, attrInput);
      $('#attributesInfo').append(attrWrapper);
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
