import SimpleBar from 'simplebar';

export default class PaletteView {
  constructor(flowController) {
    this.listeners = [];
    this.pipes = null;
    this.flowView = flowController.flowView;
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(data) {
    this.listeners.forEach(l => l.notify(data));
  }

  generatePalettePipes(pipes) {
    let cur = this,
      palette = $('#palette');

    let dragData = {
      disabled: false,
      drag: function(e) {

      },
      stop: function(e) {
        let name = e.el.firstChild.innerHTML;
        cur.flowView.modifyFlow("add", {
          name: "new" + name,
          className: name,
          xpos: 500,
          ypos: 500
        });
      }
    }

    pipes.forEach(function(item, index) {
      let toolBox = $('<div></div>').addClass('content');
      let text = $('<p></p>').text(item.name);
      toolBox.append(text);
      palette.append(toolBox);
      instance.draggable(toolBox, dragData);
    });

    new SimpleBar($('#palette')[0]);
  }
}
