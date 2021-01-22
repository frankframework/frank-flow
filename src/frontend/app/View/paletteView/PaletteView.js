import SimpleBar from 'simplebar';
// import TypeImageView from '../TypeImageView.js';

export default class PaletteView {
  constructor(flowController, ibisdocModel) {
    this.ibisdocModel = ibisdocModel;
    this.listeners = [];
    this.pipes = null;
    this.currentGroup = null;
    this.flowView = flowController.flowView;

    this.ibisdocModel.addListener(this);

    this.setEventListeners();
  }

  notify(data) {
    this.generatePalettePipes(data);
  }

  generatePalettePipes(ibisdocData) {
    const groups = [{name:'Pipes', pipes:[]},{name:'Other', pipes:[]}];

    ibisdocData.forEach((item, index) => {
      groups.forEach((group, i) => {
        const groupRegex = new RegExp(group.name, 'g');

        if(item.name.match(groupRegex)){
          group.pipes.push(...item.classes);
        }

      })
    });

    this.createGroupElements(groups);
    new SimpleBar($('#palette')[0]);
    this.setLaterEventListeners();
  }

  createGroupElements(groups) {
    const cur = this,
          groupContainer = $('#groups');

    groups.forEach((group, i) => {
      const toolBox = $('<div></div>').addClass('content-group'),
            text = $('<p></p>').text(group.name);

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
    const cur = this,
          pipes = $('#pipes');

    pipes.empty();

    group.pipes.forEach((pipe, i) => {
      const toolBox = $('<div></div>').addClass('content'),
            text = $('<p></p>').text(pipe.name);

      cur.setPipeClickEventListener(toolBox, pipe);

      toolBox.append(text);
      pipes.append(toolBox);
    });
  }

  filterPipes(input) {
    const pipes = $('#pipes'),
          pipeRegex = new RegExp(input, 'gi'),
          cur = this;

    pipes.empty();

    this.currentGroup.pipes.forEach((pipe, i) => {
      
      if(pipe.name.match(pipeRegex)){

        const toolBox = $('<div></div>').addClass('content'),
              text = $('<p></p>').text(pipe.name);

        toolBox.append(text);

        cur.setPipeClickEventListener(toolBox, pipe);

        pipes.append(toolBox);
      }
    });
  }

  setPipeClickEventListener(toolBox, pipe) {
    const cur = this;

    toolBox.on('click', function() {
      cur.flowView.modifyFlow("add", {
        name: "new" + pipe.name,
        className: pipe.name,
        xpos: 500,
        ypos: 500
      })
    });
  }

  setEventListeners() {
    const cur = this;

    $('#searchBar').on('keydown', function() {
      let searchTerm = $(this).val();
      cur.filterPipes(searchTerm);
    });
  }

  setLaterEventListeners() {
    $('.content-group').on('click', function() {
      $('.content-group.selected').removeClass('selected');
      $(this).addClass('selected');
    });
  }

}