import PipeView from './PipeView.js';


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
    let pipeView = new PipeView(this.flowView),
      types = this.flowView.getTypes(),
      cur = this;
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
          xpos: e.finalPos[0] - 500,
          ypos: e.finalPos[1]
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
  }
}
