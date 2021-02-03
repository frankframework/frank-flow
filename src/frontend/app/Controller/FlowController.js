import FlowView from '../View/flowView/FlowView.js';
import PaletteView from '../View/paletteView/PaletteView.js';
import Panzoom from '@panzoom/panzoom'

export default class FlowController {

  constructor(mainController, flowModel, ibisdocModel) {
    this.canvasMarginX = 0;
    this.canvasMarginY = 0;
    this.calculating = false;
    this.mainController = mainController;
    this.flowModel = flowModel;
    this.flowView = new FlowView(flowModel, mainController);
    this.flowView.addListener(this);
    this.paletteView = new PaletteView(this, ibisdocModel);
    this.hoverSourceWindow = false;
    this.initHandlers();

    localStorage.setItem("activityMode", "false");
  }

  //_______________Observer_______________
  
  notify(data) {
    if (data == null) {
      return;
    }
    switch (data.type) {
      case "convertConfiguration":
        this.flowModel.setTransformedXml(this.mainController.convertConfiguration());
        break;
      case "getTypes":
        this.flowView.types = this.mainController.modifyCode("getTypes");
        break;
      case "changeName":
        this.mainController.modifyCode("changeName", data);
        break;
      case "changeAddPipe":
        this.mainController.modifyCode("changeAddPipe", data);
        break;
      case "changeAddForward":
        this.mainController.modifyCode("changeAddForward", data);
        break;
      case "drag":
        this.mainController.modifyCode("changePossition", data);
        break;
      case "dragExit":
        this.mainController.modifyCode("changeExitPossition", data);
        break;
      case "delete":
        this.mainController.modifyCode("deleteForward", data);
        break;
        case "getPipeAttributes":
        let attr = this.mainController.modifyCode("getAttributes", data);
        data.pipeModel.attributes = attr;
        break;
    }
  }

  //_______________Methods to be called from handlers_______________

  toggleHorizontal() {
    let horizontalBuild = this.flowView.horizontalBuild;
    if (!horizontalBuild) {
      this.flowView.horizontalBuild = true;
      $('#toggleH').addClass('selectedItem');
    } else {
      this.flowView.horizontalBuild = false;
      $('#toggleH').removeClass('selectedItem');
    }
    this.flowView.generateFlow(this.flowView);
  }

  setTheme() {
    let theme = prompt('choose your theme!');
    if (theme.match(/theme/gi) == null) return;

    if (this.currentTheme !== null) {
      $('#canvas').removeClass(this.currentTheme);
    }
    this.currentTheme = theme;
    $('#canvas').addClass(theme);
  }

  //_______________Event handlers_______________

  initHandlers() {
    let cur = this;

    const canvas = document.getElementById('canvas')
    const panzoom = Panzoom(canvas, {
      minScale: 0.05,
      maxScale: 5,
      step: 0.2,
      excludeClass: 'window',
      contain: 'outside'
    })

    canvas.addEventListener('wheel', (event) => {
      if (!event.shiftKey) {
        panzoom.pan(-event.deltaX * 10, -event.deltaY * 10, {relative: true})
        return
      }
      panzoom.zoomWithWheel(event)
    })

    document.getElementById('panzoom-reset').addEventListener('click', panzoom.reset)
    document.getElementById('panzoom-zoom-in').addEventListener('click', panzoom.zoomIn)
    document.getElementById('panzoom-zoom-out').addEventListener('click', panzoom.zoomOut)

    $.contextMenu({
      selector: '.context-menu-one',
      zIndex: 3001,
      callback: function (key, options) {
        var m = "clicked: " + key;
        alert(m);
      },
      items: {
        "flow": {
          name: "Toggle editor", icon: "fas fa-compress",
          callback: function () {
            cur.flowView.toggleEditor();
          }
        },
        "sep1": "---------",
        "ActivityMode": {
          name: "Toggle activity mode", icon: "fas fa-globe-americas",
          callback: function () {
            if (localStorage.getItem("activityMode") === "false") {
              localStorage.setItem("activityMode", "true");
            } else {
              localStorage.setItem("activityMode", "false");
            }
            cur.mainController.generateFlow();
            return true;
          }
        },
        "realign": {
          name: 'Realign flow', icon: "fas fa-outdent",
          callback: function() {
            cur.flowView.realignFlow();
          }
        },
        "curve": {
          name: "Toggle curve", icon: "fas fa-ruler-combined",
          callback: function () {
            cur.flowView.toggleConnectorType(cur.flowView);
            return true;
          }
        },
        "horizontal": {
          name: "Toggle flow direction", icon: "fas fa-ruler-horizontal",
          callback: function () {
            cur.toggleHorizontal();
            cur.flowView.realignFlow();
            return true;
          }
        },
        "download": {
          name: "Export SVG", icon: "fas fa-file-export",
          callback: function () {
            panzoom.pan(0, 0);
            panzoom.zoom(0);
            cur.flowView.getImage();
            return true;
          }
        },
        // "editor": {name: "Editor", icon: "fas fa-file-code",
        //   callback: function() {
        //     cur.setFullEditor();
        //   }} 
      }
    });

    $('#canvas').on("click", ".sourceWindow", function (e) {
      e.preventDefault();
      cur.mainController.modifyCode("undoDecorations");
      cur.mainController.modifyCode("selectPipe", {
        name: this.lastElementChild.firstElementChild.innerHTML,
        type: this.firstElementChild.lastElementChild.innerHTML
      })
    })

    $(document).keydown(function(e){
      if(e.keyCode == 46) {
        cur.mainController.modifyCode("deletePipe");
      }
    });

    //make the bottom container draggable with mouseover
    $('#canvas').on("mouseover", ".bottomContainer" , function () {
      let sourceDiv = this.parentElement;
      let dragData = {
        disabled: false,
        containment: '#canvas',
        drag: function () {
          cur.flowView.moving = true;
          let dragObj = {
            x: $(sourceDiv).css('left'),
            y: $(sourceDiv).css('top'),
            name: sourceDiv.lastElementChild.firstElementChild.innerHTML
          }
          let isGenerating = false;
          if (dragObj.x === "0px" && cur.calculating === false) {
            cur.calculating = true;
            isGenerating = true;
            calculateCanvasBorder('left');
            cur.flowView.generateFlow();
            return false;
          }
          if (dragObj.y === "0px" && cur.calculating === false) {
            cur.calculating = true;
            calculateCanvasBorder('top');
            cur.flowView.generateFlow();
          }
          if ($(sourceDiv).hasClass('exit') && !isGenerating) {
            cur.flowView.modifyFlow('dragExit', dragObj);
          } else if (!isGenerating) {
            cur.flowView.modifyFlow('drag', dragObj);
          }
        },
        stop: function (event, ui) {
          cur.flowView.moving = false;
        }
      }
      instance.draggable(sourceDiv, dragData);
      if (instance.isSourceEnabled(sourceDiv)) {
        instance.toggleSourceEnabled(sourceDiv);
      }
      $(this).addClass("element-disabled");
    });

    //when leaving container not draggable
    jsPlumb.on($('#canvas'), "mouseout", ".bottomContainer", function () {
      let sourceDiv = this.parentElement;
      instance.draggable(sourceDiv, {
        disabled: true
      });
      if (!instance.isSourceEnabled(sourceDiv)) {
        instance.toggleSourceEnabled(sourceDiv);
      }
      $(this).removeClass("element-disabled");
    });

    //set canvas bounded to container.
    var minScaleX = $('#flowContainer').innerWidth();
    var minScaleY = $('#flowContainer').innerHeight();

    /*
    save canvas size and update positions in generation.


    int canvasSizeX = 0;
    int canvasSizeY = 0;

    canvasSizeX = 500;
    canvasSizeY = 200;

    left += canvasSizeX;
    top += cansSizeY;

    */

    function calculateCanvasBorder(direction) {
      $('#canvas').css('min-width', '+=500');
      let centerX = parseInt($('#canvas').css('min-width').replace('px', '')) / 2;

      $('.sourceWindow').each((index, element) => {

        $(element).css(direction, '+=500')
        let pipe = {
          x: $(element).css('left'),
          y: $(element).css('top'),
          name: element.lastElementChild.firstElementChild.innerHTML
        }
        if ($(element).hasClass('exit')) {
          cur.flowView.modifyFlow('dragExit', pipe);
        } else {
          cur.flowView.modifyFlow('drag', pipe);
        }
      })
      
      setTimeout(function () {
        cur.calculating = false;
      }, 3000);
    }
  }
}
