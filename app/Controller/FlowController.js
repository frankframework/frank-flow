import FlowView from '../View/flowView/FlowView.js';
import PaletteView from '../View/flowView/PaletteView.js';

export default class FlowController {

  constructor(mainController) {
    this.mainController = mainController;
    this.flowView = new FlowView();
    this.flowView.addListener(this);
    this.paletteView = new PaletteView(this);
    this.paletteView.addListener(this);
    this.notify({
      type: "getPipes"
    });
    this.hoverSourceWindow = false;
    this.initHandlers();
  }

  notify(data) {
    if (data == null) {
      return;
    };
    switch (data.type) {
      case "convertConfiguration":
        this.flowView.transformedXml = this.mainController.convertConfiguration();
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

  initHandlers() {
    let cur = this;



    $('#addPipe').click(function() {
      cur.flowView.modifyFlow('add', {
        name: "newPipe",
        className: "customPipe"
      });
    });

    $('#downloadLink').click(function() {
      cur.flowView.getImage();
    })

    $('#setData').click(function() {
      cur.flowView.generateFlow(cur.flowView);
    });

    $('#lineChanges').click(function() {
      cur.flowView.toggleConnectorType(cur.flowView);
    });

    //toggle building the flow in horizontal mode.
    $('#toggleH').click(function() {
      let horizontalBuild = cur.flowView.horizontalBuild;
      if (!horizontalBuild) {
        cur.flowView.horizontalBuild = true;
        $('#toggleH').addClass('selectedItem');
      } else {
        cur.flowView.horizontalBuild = false;
        $('#toggleH').removeClass('selectedItem');
      }
      cur.flowView.generateFlow(cur.flowView);
    });

    $('#fullFlow').on('click', function() {
      $('#flowContainer').addClass('fullFlowContainer');
      $('#flowContainer').css('display', 'flex');
      $('#monacoContainer').css('display', 'none');
      $('#palette').css('display', 'flex');
      $('.monaco-flow-wrapper').css('justify-content', 'flex-end');
      cur.flowView.customWidth = true;
    });

    $('#fullEditor').on('click', function() {
      $('#monacoContainer').addClass('fullMonacoContainer');
      $('#monacoContainer').css('display', 'flex');
      $('#flowContainer').css('display', 'none');
      $('#palette').css('display', 'none');
    });

    $('#normalLayout').on('click', function() {
      $('#monacoContainer').removeClass('fullMonacoContainer');
      $('#flowContainer').removeClass('fullFlowContainer');
      $('#palette').css('display', 'flex');
      $('#monacoContainer').css('display', 'flex');
      $('#flowContainer').css('display', 'flex');
    });

    $('#setTheme').on('click', function() {
      let theme = prompt('choose your theme!');
      if(theme.match(/theme/gi) == null) return;

      if(cur.currentTheme !== null) {
        $('#canvas').removeClass(cur.currentTheme);
      }
      cur.currentTheme = theme;
      $('#canvas').addClass(theme);
    })

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
          //console.log(cur.flowView.modifyFlow);
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
      }
      if (current_pullX <= -1540) {
        $panzoom.panzoom('pan', -1540, current_pullY);
      }
      if (current_pullY >= 0) {
        $panzoom.panzoom('pan', current_pullX, 0);
      }
      $('#flowContainer').attr('style', '');
    });

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
