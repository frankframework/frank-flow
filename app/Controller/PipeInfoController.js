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
    let attributes = this.mainController.modifyCode("getAttributes", {name: name});
    this.pipeInfoView.generatePipeAttributes(attributes);
    console.log(attributes);
  }

  //change the name in the configuration and set the previous name to the new name.
  changeName(oldName, newName) {
    this.mainController.modifyCode("changeName",
    {
      oldName: oldName,
      newName: newName
    })
    this.oldName = newName;
  }

  //change the type in the configuration and update the previous name to the new name.
  changeType(type) {
    let cur = this;
    this.mainController.modifyCode("changePipeType",
    {
      name:  cur.oldName,
      type: type,
      oldType: cur.oldType
    })
    this.oldType = type;
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
    })
  }
}
