import PipeInfoView from '../View/pipeInfoView/PipeInfoView.js';

export default class PipeInfoController {

  constructor(mainController, ibisdocModel) {
    this.ibisdocModel = ibisdocModel;
    this.mainController = mainController;
    this.pipeInfoView = new PipeInfoView();
    this.ibisdocModel.addListener(this);
    this.setEventListeners();
  }

  notify(data) {
    this.pipeInfoView.generateTypes(data);
  }

  selectPipe(name, type) {
    this.oldName = name;
    this.oldType = type;
    this.pipeInfoView.setPipeName(name);
    this.pipeInfoView.setPipeType(type);
  }

  changeName(oldName, newName) {
    this.mainController.modifyCode("changeName",
    {
      oldName: oldName,
      newName: newName
    })
    this.oldName = newName;
  }

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
