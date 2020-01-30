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
    types = this.flowView.getTypes();
    // xmlButton = $('<button></button>').attr('type', 'button').addClass('collapsible listItem').text("xml pipes"),
    // xmlCollaps = $('<div></div>').addClass('content'),
    palette = $('#palette');
    // palette.append(xmlButton, xmlCollaps);
    pipes.forEach(function(item, index) {
      let img,
      strong = $('<strong></strong>').text(item.name),
      button = $('<button></button>').attr('type', 'button').addClass('collapsible listItem'),
      collapsBox = $('<div></div>').addClass('content'),
      buttonText = $('<span></span>').addClass('buttonText').text(item.name);
      img = pipeView.getTypeImage(item.name, true, types).attr('id', item.name );
      button.append(buttonText);
      collapsBox.append(img);
      // if(item.name.match(/Xml/g) != null) {
      //   xmlCollaps.append(button, collapsBox);
      //   return;
      // }
      palette.append(button, collapsBox);
    });
    this.setHandlers();
  }

  setHandlers() {
    let cur = this;
    var coll = document.getElementsByClassName("collapsible");
    var i;

    for (i = 0; i < coll.length; i++) {
      coll[i].addEventListener("click", function() {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (content.style.display === "block") {
          content.style.display = "none";
        } else {
          content.style.display = "block";
        }
      });
    }

    $('#canvas').on('dragover', function(ev) {
      ev.preventDefault();
      ev.stopPropagation()
    });
    $('#canvas').on('drop', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      let data = localStorage.getItem('dropPipe');
      cur.flowView.modifyFlow("add", {
        name: "new" + data,
        className: data
      });
      //insert pipe in editor
    })
    $('.typeImg').on('dragstart', function(ev) {
      console.log('drag');
      localStorage.setItem("dropPipe", ev.target.id);
    });
  }
}
