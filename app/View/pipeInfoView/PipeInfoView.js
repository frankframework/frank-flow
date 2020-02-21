export default class PipeInfoView {

  constructor () {
    this.pipeName = "FixedResult";
    this.pipeType = "CheckEmptyMessage";
    this.setPipeName(this.pipeName);
  }

  setPipeName(name) {
    this.pipeName = name;
    $('#pipeInfoName').val(name);
    this.refreshTitle();
  }

  setPipeType(type) {
    this.pipeType = type;
    $('#typeSelect').val(type);
    this.refreshTitle();
  }

  refreshTitle() {
    $('#pipeInfoTitleName').text(this.pipeName);
    $('#pipeInfoTitleType').text(this.pipeType);
  }

  generateTypes(data) {
    let option;
    data[2].classes.forEach(function(item, index) {
      option = $('<option></option>').attr('value', item.name).text(item.name);
      $('#typeSelect').append(option);
    })
  }
}
