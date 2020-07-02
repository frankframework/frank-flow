import FlowView from '../View/flowView/FlowView.js';
import PaletteView from '../View/paletteView/PaletteView.js';

export default class FlowController {

  constructor(mainController, flowModel) {
    this.mainController = mainController;
    this.flowModel = flowModel;
    this.flowView = new FlowView(flowModel);
    this.flowView.addListener(this);
    this.paletteView = new PaletteView(this);
    this.paletteView.addListener(this);
    this.hoverSourceWindow = false;
    this.initHandlers();
  }

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
        console.log("name changer")
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
    }
  }

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

  setFullFlow() {
    $('#flowContainer').addClass('fullFlowContainer');
    $('#flowContainer').css('display', 'flex');
    $('#monacoContainer').css('display', 'none');
    $('#palette').css('display', 'flex');
    $('.monaco-flow-wrapper').css('justify-content', 'flex-end');
    this.flowView.customWidth = true;
  }

  setFullEditor() {
    $('#monacoContainer').addClass('fullMonacoContainer');
    $('#monacoContainer').css('display', 'flex');
    $('#flowContainer').css('display', 'none');
    $('#palette').css('display', 'none');
  }

  setHybrid() {
    $('#monacoContainer').removeClass('fullMonacoContainer');
    $('#flowContainer').removeClass('fullFlowContainer');
    $('#palette').css('display', 'flex');
    $('#monacoContainer').css('display', 'flex');
    $('#flowContainer').css('display', 'flex');
  }

  setTheme() {
    let theme = prompt('choose your theme!');
    if(theme.match(/theme/gi) == null) return;

    if(this.currentTheme !== null) {
      $('#canvas').removeClass(this.currentTheme);
    }
    this.currentTheme = theme;
    $('#canvas').addClass(theme);
  }

  initHandlers() {
    let cur = this;
      $.contextMenu({
        selector: '.context-menu-one',
        zIndex: 3001,
        callback: function(key, options) {
            var m = "clicked: " + key;
            window.console && console.log(m) || alert(m); 
        },
        items: {
            "tibcoMode": {name: "Tibco mode", icon: "fas fa-globe-americas",
            callback: function() {
              return true;
            }},
            "curve": {name: "Toggle curve", icon: "fas fa-ruler-combined",
            callback: function() {
              cur.flowView.toggleConnectorType(cur.flowView);
              return true;
            }},
            "horizontal": {name: "Toggle horizontal", icon: "fas fa-ruler-horizontal",
              callback: function() {
                cur.toggleHorizontal();
                return true;
            }},
            "xsd": {name: "Run XSD", icon: "fas fa-play-circle"},
            "download": {name: "Export SVG", icon: "paste",
              callback: function() {
                cur.flowView.getImage();
                return true;
              }},
            "theme": {name: "Set theme", icon: "fas fa-adjust",
              callback: function() {
                cur.setTheme();
              }},
            "sep1": "---------",
            "flow": {name: "Flow fullscreen", icon: "fas fa-compress",
              callback: function() {
                cur.setFullFlow();
              }},
            "hybrid": {name: "Hybrid", icon: "fas fa-window-restore",
              callback: function() {
                cur.setHybrid();
              }},
            // "editor": {name: "Editor", icon: "fas fa-file-code",
            //   callback: function() {
            //     cur.setFullEditor();
            //   }}
        }
    });

    //rename a pipe
    $("#canvas").on('dblclick', '#strong', function(e) {
      e.stopPropagation();
      console.log("dblclick!");
      if (this.innerHTML !== "EXIT") {
        cur.flowView.modifyFlow('edit', this);
      }
    });



    jsPlumb.on($('#canvas'), "mouseover", ".sourceWindow, .description", function() {
      $panzoom.panzoom("disable");
    });

    jsPlumb.on($('#canvas'), "mouseout", ".sourceWindow, .description", function() {
      $panzoom.panzoom("enable");
      $('#flowContainer').attr('style', '');
    });

    $('#canvas').on("click", ".sourceWindow", function(e) {
      e.preventDefault();
      cur.mainController.modifyCode("undoDecorations");
      cur.mainController.modifyCode("selectPipe", {
        name: this.lastElementChild.firstElementChild.innerHTML,
        type: this.firstElementChild.lastElementChild.innerHTML
      })
    })


    //make the bottom container draggable with mouseover
    jsPlumb.on($('#canvas'), "mouseover", ".bottomContainer", function() {
      let sourceDiv = this.parentElement;
      let dragData = {
        disabled: false,
        containment: '#canvas',
        drag: function() {
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
        stop: function(event, ui) {
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
    jsPlumb.on($('#canvas'), "mouseout", ".bottomContainer", function() {
      let sourceDiv = this.parentElement;
      instance.draggable(sourceDiv, {
        disabled: true
      });
      if (!instance.isSourceEnabled(sourceDiv)) {
        instance.toggleSourceEnabled(sourceDiv);
      }
      $(this).removeClass("element-disabled");
    });

    //contain canvas to container.
    var minScaleX = $('#flowContainer').innerWidth();
    var minScaleY = $('#flowContainer').innerHeight();
    let $panzoom = $('#canvas').panzoom({
      minScale: 0.5,
      increment: 0.2
    });

    //make sure panzoom doesn't leave the container.
    $panzoom.on('panzoomend', function(e) {
      var current_pullY = parseInt($('#canvas').css('transform').split(',')[5]);
      var current_pullX = parseInt($('#canvas').css('transform').split(',')[4]);
      if (current_pullX >= 0) {
         $panzoom.panzoom('pan', 0, current_pullY);
      }
      if (current_pullY <= -Math.abs($('#canvas').css('height').replace('px', '')) + 1000) {
        $panzoom.panzoom('pan', current_pullX, -Math.abs($('#canvas').css('height').replace('px', '')) + 1000);
        console.log('y< 1000');
      }
      if (current_pullX <= -1540) {
        $panzoom.panzoom('pan', -1540, current_pullY);
        console.log('x< 1540');
      }
      if (current_pullY >= 0) {
        $panzoom.panzoom('pan', current_pullX, 0);
        console.log('y> 0');
      }
      $('#flowContainer').attr('style', '');
    });

    function calculateCanvasBorder(direction) {
        $('#canvas').css('min-width', '+=500');
        let centerX = parseInt($('#canvas').css('min-width').replace('px', '')) / 2;
        console.log('centerX: ' + centerX);
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
        console.log('x> 0', $('#canvas').css('min-width'));
    }

    //make zoom possible
    $panzoom.parent().on('mousewheel.focal', function(e) {
      if (!e.shiftKey) return;
      e.preventDefault();
      var delta = e.delta || e.originalEvent.wheelDelta;
      var zoomOut = delta ? delta < 0 : e.originalEvent.deltaY > 0;
      $panzoom.panzoom('zoom', zoomOut, {
        increment: 0.1,
        focal: e
      });
    });

    $('#slider').on('input', function(e) {
      $panzoom.panzoom("enable");
      let zoom = $('#slider').val();
      let plus = true;
      if (cur.prevZoom) {
        if (cur.prevZoom < zoom && zoom != 10 && zoom != 9) {
          plus = false;
        } else if (zoom == 10) {
          plus = false;
        }
      } else {
        cur.prevZoom = zoom;
      }
      cur.prevZoom = zoom;
      $panzoom.panzoom('zoom', plus, {
        increment: 0.1,
        step: 0.1
      });
    });
  }
}
