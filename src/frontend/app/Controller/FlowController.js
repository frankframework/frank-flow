import FlowView from '../View/flowView/FlowView.js';
import PaletteView from '../View/paletteView/PaletteView.js';

export default class FlowController {

  constructor(mainController, flowModel) {
    this.canvasMarginX = 0;
    this.canvasMarginY = 0;

    this.mainController = mainController;
    this.flowModel = flowModel;
    this.flowView = new FlowView(flowModel, mainController);
    this.flowView.addListener(this);
    this.paletteView = new PaletteView(this);
    this.paletteView.addListener(this);
    this.hoverSourceWindow = false;
    this.initHandlers();


    localStorage.setItem("activityMode", false);
  }

  //_______________Observer_______________
  
  notify(data) {
    if (data == null) {
      return;
    };
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
    let $panzoom = $('#canvas').panzoom({
      minScale: 0.5,
      increment: 0.2
    });

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
            if (localStorage.getItem("activityMode") == "false") {
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
            $panzoom.panzoom('pan', 0, 0);
            $panzoom.panzoom('zoom', 0, 0);
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


    jsPlumb.on($('#canvas'), "mouseover", ".sourceWindow, .description", function () {
      $panzoom.panzoom("disable");
    });

    jsPlumb.on($('#canvas'), "mouseout", ".sourceWindow, .description", function () {
      $panzoom.panzoom("enable");
      $('#flowContainer').attr('style', '');
    });

    $('#canvas').on("click", ".sourceWindow", function (e) {
      e.preventDefault();
      cur.mainController.modifyCode("undoDecorations");
      cur.mainController.modifyCode("selectPipe", {
        name: this.lastElementChild.firstElementChild.innerHTML,
        type: this.firstElementChild.lastElementChild.innerHTML
      })
    })


    //make the bottom container draggable with mouseover
    jsPlumb.on($('#canvas'), "mouseover", ".bottomContainer", function () {
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
          if ($(sourceDiv).hasClass('exit')) {
            cur.flowView.modifyFlow('dragExit', dragObj);
          } else {
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


    //make sure panzoom doesn't leave the container.
    $panzoom.on('panzoomend', function (e) {
      var current_pullY = parseInt($('#canvas').css('transform').split(',')[5]);
      var current_pullX = parseInt($('#canvas').css('transform').split(',')[4]);
      if (current_pullX >= 0) {
        $panzoom.panzoom('pan', 0, current_pullY);
      }
      if (current_pullY <= -Math.abs($('#canvas').css('height').replace('px', '')) + 1000) {
        $panzoom.panzoom('pan', current_pullX, -Math.abs($('#canvas').css('height').replace('px', '')) + 1000);
      }
      if (current_pullX <= -1540) {
        $panzoom.panzoom('pan', -1540, current_pullY);
      }
      if (current_pullY >= 0) {
        $panzoom.panzoom('pan', current_pullX, 0);
      }
      $('#flowContainer').attr('style', '');
    });

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

        $(element).css('left', '+=250')
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
      });
    }

    //make zoom possible
    $panzoom.parent().on('mousewheel.focal', function (e) {
      if (!e.shiftKey) return;
      e.preventDefault();
      var delta = e.delta || e.originalEvent.wheelDelta;
      var zoomOut = delta ? delta < 0 : e.originalEvent.deltaY > 0;
      $panzoom.panzoom('zoom', zoomOut, {
        increment: 0.1,
        focal: e
      });
    });
  }
}
