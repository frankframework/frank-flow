import FlowGenerator from './FlowGenerator.js'
export default class FlowView {

  constructor() {
    this.transformedXml = null;
    this.types = [];
    this.listeners = [];
    this.windows = 0;
    this.moving = false;
    this.adding = false;
    this.connectorType = "Flowchart";
    this.horizontalBuild = false;
    this.flowGenerator = new FlowGenerator(this);
    this.getInstance();
  }
  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(data) {
    this.listeners.forEach(l => l.notify(data));
  }

  getImage() {
    var node = document.getElementById('canvas');

    domtoimage.toSvg(node)
      .then(function(dataUrl) {
        var link = document.createElement('a');;
        link.download = localStorage.getItem('currentAdapter') + '.svg';
        link.href = dataUrl;
        link.click();
      })
      .catch(function(error) {
        console.error('oops, something went wrong!', error);
      });
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
        // drag options
        DragOptions: {
          cursor: "pointer",
          zIndex: 2000
        },
        // default to a gradient stroke from blue to green.
        PaintStyle: {
          stroke: "#000000",
          strokeWidth: 3
        },
        //the arrow overlay for the connection
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

  /*
   * one function to modify the flow and code at the same time.
   * @param change: insert here the action you want to do.
   * @param obj: insert an object with necessary information.
   */
  modifyFlow(change, obj) {
    switch (change) {
      case "generate":
        this.generateFlow();
        break;
      case 'add':
        this.notifyListeners(this.addCustomPipe(obj.name, obj.className));
        break;
      case 'edit':
        this.notifyListeners(this.editTitle(obj));
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

  addCustomPipe(name, className) {
    let newPipe = this.addPipe(name, {
      x: 100,
      y: 100
    });

    return {
      type: "changeAddPipe",
      name: newPipe,
      possitions: {
        x: 100,
        y: 100
      },
      className: className
    }
  }

  toggleConnectorType(cur) {
    if (cur.connectorType === "Flowchart") {
      cur.connectorType = "StateMachine";
    } else {
      cur.connectorType = "Flowchart";
    }
    cur.generateFlow();
  }

  addPipe(name, possitions, extra, isExit) {
    return this.flowGenerator.addPipe(name, possitions, extra, isExit);
  }

  getTypes() {
    this.notifyListeners({
      type: "getTypes"
    });
    return this.types;
  }

  // a function to put distance between the pipes
  setOffsets(possitions) {
    let boxOffset = 0;
    let container = null;

    this.moving = true;
    for (let i = 1; i <= this.windows; i++) {
      boxOffset += 250;
      if (!possitions) {
        let box = $('#sourceWindow' + i);
        if (!this.horizontalBuild) {
          box.css("top", boxOffset + "px");
        } else {
          box.css("top", "100px");
          box.css("left", boxOffset + "px");
        }
        this.modifyFlow('drag', {
          name: box[0].lastChild.firstElementChild.textContent,
          x: box.css("left"),
          y: box.css("top")
        })
      }
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
        if (totalLength > windowLength) {
          $('#canvas').css('width', totalLength);
        }
      }
    }
    this.moving = false;
  }

  generateFlow() {
    this.notifyListeners({
      type: "convertConfiguration"
    });
    this.flowGenerator.generateFlow(this.transformedXml, this.windows);
  }

  displayError(e) {
    instance.reset();
    $('#canvas').empty();
    $('#canvas').css('display', 'none');
    $('.customErrorMessage').remove();
    $('#flowContainer').append($("<h1></h1>").text('Error' + e).addClass('customErrorMessage'));
  }
}
