import GenerateInfoParametersView from './parameters/GenerateInfoParametersView';
import GenerateInfoAttributesView from './attributes/GenerateInfoAttributesView';

export default class PipeInfoView {

  constructor(flowModel) {
    this.flowModel = flowModel;
    this.pipeName = "FixedResult";
    this.pipeType = "CheckEmptyMessage";
    this.setPipeName(this.pipeName);
    this.generatePipeForwards();
    $('.pipeInfo').tabs();
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

  generatePipeForwards() {
    let cur = this;
    this.flowModel.getForwards().forEach(function(item, index) {

      if (item.sourcePipe == cur.pipeName) {
        $('#forwardsInfo').append($('<p></p>').text(item.targetPipe + ' - ' + item.name).addClass('forwardInfo'));
      }
    })
  }

  generatePipeAttributes(parameters) {
    let attributeGenerator = new GenerateInfoAttributesView();
    attributeGenerator.generatePipeAttributes(parameters);
  }

  generatePipeParameters(parameters) {
    let paramGenerator = new GenerateInfoParametersView();
    paramGenerator.generatePipeParameters(parameters);
  }

  generateTypes(data) {
    let option;
    data[2].classes.forEach(function(item, index) {
      option = $('<option></option>').attr('value', item.name).text(item.name);
      $('#typeSelect').append(option);
    })
  }
}
