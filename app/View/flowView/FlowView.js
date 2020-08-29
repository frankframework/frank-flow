import FlowGenerator from './flowGeneration/FlowGenerator.js'
export default class FlowView {

  constructor(flowModel) {
    this.transformedXml = null;
    this.flowModel = flowModel;
    this.types = [];
    this.listeners = [];
    this.windows = 0;
    this.moving = false;
    this.adding = false;
    this.connectorType = "Flowchart";
    this.horizontalBuild = false;
    this.flowGenerator = new FlowGenerator(this, flowModel);
    this.getInstance();
  }
  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(data) {
    this.listeners.forEach(l => l.notify(data));
  }

  resetWindows() {
    this.windows = 0;
  }

  getInstance() {
    this.sourceAnchors = [
      "Top", "Right", "Left",
      [0.25, 1, 0, 1],
      [0.5, 1, 0, 1],
      [0.75, 1, 0, 1],
      [1, 1, 0, 1]
    ],
      this.instance = window.instance = jsPlumb.getInstance({
        DragOptions: {
          cursor: "pointer",
          zIndex: 2000
        },
        PaintStyle: {
          stroke: "#000000",
          strokeWidth: 3
        },
        ConnectionOverlays: [
          ["Arrow", {
            location: 1,
            visible: true,
            id: "ARROW",
            zIndex: 1000
          }]
        ],
        Container: "canvas"
      });

    this.setBasicType();

  }

  setBasicType() {
    let basicType = {
      connector: ["StateMachine", {
        stub: [40, 60],
        gap: 10,
        cornerRadius: 5,
        alwaysRespectStubs: true
      }]
    }
    this.instance.registerConnectionType("basic", basicType);
  }

  modifyFlow(change, obj) {
    switch (change) {
      case "generate":
        this.generateFlow();
        break;
      case 'add':
        if (obj.xpos == null || obj.ypos == null) {
          obj.xpos = 100;
          obj.ypos = 100;
        }
        this.notifyListeners(this.addCustomPipe(obj.name, obj.className, obj.xpos, obj.ypos));
        break;
      case 'edit':
        obj = this.editTitle(obj);
        obj.type = "changeName";
        this.notifyListeners(obj);
        break;
      case 'connection':
        this.adding = true;
        obj.type = "changeAddForward";
        this.notifyListeners(obj);
        this.adding = false;
        break;
      case 'drag':
        obj = this.cleanPossitions(obj);
        obj.type = "drag";
        this.notifyListeners(obj);
        break;
      case 'dragExit':
        obj = this.cleanPossitions(obj);
        obj.type = "dragExit";
        this.notifyListeners(obj);
        break;
      case 'delete':
        obj.type = "delete";
        this.notifyListeners(obj);
        break;
      case "error":
        this.displayError(obj);
        break;
    }
  }

  getImage() {
    var node = document.getElementById('canvas');

    domtoimage.toSvg(node)
      .then(function (dataUrl) {
        var link = document.createElement('a');
        link.download = localStorage.getItem('currentAdapter') + '.svg';
        link.href = dataUrl;
        link.click();
      })
      .catch(function (error) {
        console.error('oops, something went wrong!', error);
      });
  }

  addCustomPipe(name, className, xpos, ypos) {
    return {
      type: "changeAddPipe",
      name: name,
      possitions: {
        x: xpos,
        y: ypos
      },
      className: className
    }
  }

  cleanPossitions(obj) {
    obj.x = obj.x.replace(/px/, '');
    obj.y = obj.y.replace(/px/, '');
    return obj;
  }

  editTitle(pipe) {
    let oldTitle = pipe.innerHTML;
    let newTitle = prompt("What is the new Title?", oldTitle);
    if (newTitle != null) {
      pipe.innerHTML = newTitle;
      return {
        oldTitle: oldTitle,
        newTitle: newTitle
      }
    }
    return null;
  }


  toggleConnectorType(cur) {
    if (cur.connectorType === "Flowchart") {
      cur.connectorType = "StateMachine";
    } else {
      cur.connectorType = "Flowchart";
    }
    cur.generateFlow();
  }

  getTypes() {
    this.notifyListeners({
      type: "getTypes"
    });
    return this.types;
  }

  setOffsets(possitions) {
    let boxOffset = 0,
      exitOffset = 0;

    this.moving = true;
    for (let i = 1; i <= this.windows; i++) {

      if (!$('#sourceWindow' + (i - 1)).hasClass('exit')) {
        boxOffset += 250;
      }
      if (!possitions) {
        let box = $('#sourceWindow' + i);
        this.setBuildDirection(box, boxOffset);
        if (this.windows == 2) {
          this.moving = false;
          return;
        }
        this.setExitPosition(box, exitOffset);
      }
      this.setCanvasBounds(boxOffset, i);
    }
    this.moving = false;
  }

  setBuildDirection(box, boxOffset) {
    if (!this.horizontalBuild) {
      box.css("top", boxOffset + "px");
    } else {
      box.css("top", "100px");
      box.css("left", boxOffset + "px");
    }
  }

  setExitPosition(box, exitOffset) {
    if (!box.hasClass('exit')) {
      this.modifyFlow('drag', {
        name: box[0].lastChild.firstElementChild.textContent,
        x: box.css("left"),
        y: box.css("top")
      });
    } else {
      exitOffset += 250;
      this.modifyFlow('dragExit', {
        name: box[0].lastChild.firstElementChild.textContent,
        x: parseInt(box.css("left").replace('px', '')) + exitOffset + 'px',
        y: box.css("top")
      });
    }
  }

  setCanvasBounds(boxOffset, i) {
    let totalLength, windowLength;
    if (!this.horizontalBuild) {
      totalLength = boxOffset + ((64 * i) - 1450);
      windowLength = parseInt($('#canvas').css('height').replace('px', ''));
      if (totalLength > windowLength) {
        $('#canvas').css('height', totalLength);
      }
    } else {
      totalLength = boxOffset + ((64 * i) - 1000);
      windowLength = parseInt($('#canvas').css('width').replace('px', ''));
      if (totalLength > windowLength && !this.customWidth) {
        $('#canvas').css('width', totalLength);
      }
    }
  }



  generateFlow() {
    this.notifyListeners({
      type: "convertConfiguration"
    });
    this.flowGenerator.generateFlow();
  }

  displayError(e) {
    instance.reset();
    $('#canvas').empty();
    $('#canvas').css('display', 'none');
    $('.customErrorMessage').remove();
    if (e == "dupplicate") {
      $('#flowContainer').append(
        $("<h1></h1>").text('Duplicate pipe, please remove any duplicates.').addClass('customErrorMessage'),
      );
    } else if(typeof(this.flowModel.getTransformedXml()) == "string"){
      $('#flowContainer').append(
        $("<h1></h1>").text('Configuration is incorrect, please check your xml.').addClass('customErrorMessage'),
        $('<p></p>').text(' \n\n\n your error: \n' + this.flowModel.getTransformedXml()).addClass('customErrorMessage')
      );
    } else {
      $('#flowContainer').append(
        $("<h1></h1>").text('Configuration is incorrect, please check your xml.').addClass('customErrorMessage'),
        $('<p></p>').text(' \n\n\n your error: \n' + e).addClass('customErrorMessage')
      );
    }
    console.log('error: ', e, this.flowModel.getTransformedXml())
  }
}
