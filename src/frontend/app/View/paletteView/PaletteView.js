import SimpleBar from 'simplebar';
// import TypeImageView from '../TypeImageView.js';

export default class PaletteView {
  constructor(flowController) {
    this.listeners = [];
    this.pipes = null;
    this.currentGroup = null;
    this.flowView = flowController.flowView;
    this.setEventListeners();
    // this.typeImageView = new TypeImageView(this.flowView);
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(data) {
    this.listeners.forEach(l => l.notify(data));
  }

  generatePalettePipes(data) {
    let groups = [{name:'Pipes', pipes:[]},{name:'Other', pipes:[]}];

    data.forEach(function(item, index) {
      groups.forEach((group, i) => {
        let re = new RegExp(group.name, 'g');

        if(item.name.match(re)){
          group.pipes.push(...item.classes);
        }
      })
    });

    this.createGroupElements(groups);
    new SimpleBar($('#palette')[0]);
    this.setLaterEventListeners();
  }

  createGroupElements(groups) {
    let cur = this;
    let groupContainer = $('#groups');
    groups.forEach((group, i) => {
      let toolBox = $('<div></div>').addClass('content-group');
      let text = $('<p></p>').text(group.name);
      toolBox.append(text);
      toolBox.click(() => {
        cur.setPipeElement(group);
      });
      groupContainer.append(toolBox);
    });
    cur.setPipeElement(groups[0]);
  }

  setPipeElement(group) {
    this.currentGroup = group;
    let cur = this;
    let pipes = $('#pipes');
    pipes.empty();

    group.pipes.forEach((pipe, i) => {
      let toolBox = $('<div></div>').addClass('content');
      let text = $('<p></p>').text(pipe.name);

      toolBox.on('click', function() {
        cur.flowView.modifyFlow("add", {
          name: "new" + pipe.name,
          className: pipe.name,
          xpos: 500,
          ypos: 500
        })
      });
      toolBox.append(text);
      pipes.append(toolBox);
    });
  }

  filterPipes(input) {
    let tempPipes = this.currentGroup;
    let pipes = $('#pipes');
    let re = new RegExp(input, 'gi');

    pipes.empty();

    tempPipes.pipes.forEach((pipe, i) => {
      if(pipe.name.match(re)){

        let toolBox = $('<div></div>').addClass('content');
        let text = $('<p></p>').text(pipe.name);
        toolBox.append(text);
        pipes.append(toolBox);
      }
    });
  }

  setEventListeners() {
    let cur = this;

    $('#searchBar').on('keydown', function() {
      let searchTerm = $(this).val();
      cur.filterPipes(searchTerm);
    });
  }

  setLaterEventListeners() {
    $('.content-group').on('click', function() {
      $('.selected').removeClass('selected');
      $(this).addClass('selected');
    });
  }

  // getTypeImage(type) {
  //   return this.typeImageView.getTypeImage(type);
  // }
}