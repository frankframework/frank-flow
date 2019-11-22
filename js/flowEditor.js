/*jslint
    browser: true, for: true
*/
var windows = 0,
  moving = false,
  adding = false,
  connectorType = "Flowchart",
  horizontalBuild = false;
jsPlumb.ready(function() {
  // list of possible anchor locations for the blue source element
  var sourceAnchors = [
      "Top", "Right", "Left",
      [0.25, 1, 0, 1],
      [0.5, 1, 0, 1],
      [0.75, 1, 0, 1],
      [1, 1, 0, 1]
    ],
    instance = window.instance = jsPlumb.getInstance({
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
  instance.registerConnectionType("basic", basicType);
  //listeners

  $('#addPipe').click(function() {
    modifyFlow('add');
  });

  $('#setData').click(generateFlow);

  $('#lineChanges').click(toggleConnectorType);
  $('#toggleH').click(function() {
    if (!horizontalBuild) {
      horizontalBuild = true;
      $('#toggleH').addClass('selectedItem');
    } else {
      horizontalBuild = false;
      $('#toggleH').removeClass('selectedItem');
    }
    generateFlow();
  });

  $('#runXsd').click(function() {
    let validate = validateConfiguration(),
      lineNumber = 0;
    undoDecorations();
    if (validate.errors !== null) {
      console.log(validate.errors);
      validate.errors.forEach(function(item, index) {
        lineNumber = item.match(/:.*?:/)[0].replace(/:/g, '');
        decorateLine(lineNumber);
      });
    }
  })

  $("#canvas").on('dblclick', '#strong', function() {
    if (this.innerHTML !== "EXIT") {
      modifyFlow('edit', this);
    }
  });

  jsPlumb.on($('#canvas'), "mouseover", ".sourceWindow", function() {
    $panzoom.panzoom("disable");
  });

  jsPlumb.on($('#canvas'), "mouseout", ".sourceWindow", function() {
    $panzoom.panzoom("enable");
    $('#flowContainer').attr('style', '');
  });

  jsPlumb.on($('#canvas'), "mouseover", ".bottomContainer", function() {
    let sourceDiv = this.parentElement;
    let dragData = {
      disabled: false,
      containment: '#canvas',
      drag: function() {
        moving = true;
        let dragObj = {
                x: $(sourceDiv).css('left'),
                y: $(sourceDiv).css('top'),
                name: sourceDiv.lastElementChild.firstElementChild.innerHTML
              }
        if($(sourceDiv).hasClass('exit')) {
        	modifyFlow('dragExit', dragObj);
        } else {
        modifyFlow('drag', dragObj);
        }
      },
      stop: function(event, ui) {
        moving = false;
      }
    }
    instance.draggable(sourceDiv, dragData);
    if (instance.isSourceEnabled(sourceDiv)) {
      instance.toggleSourceEnabled(sourceDiv);
    }
    $(this).addClass("element-disabled");
  });

  jsPlumb.on($('#canvas'), "mouseout", ".bottomContainer", function() {
    let sourceDiv = this.parentElement;
    instance.draggable(sourceDiv, {disabled: true});
    if (!instance.isSourceEnabled(sourceDiv)) {
      instance.toggleSourceEnabled(sourceDiv);
    }
    $(this).removeClass("element-disabled");
  });


  //contain canvas to container
  var minScaleX = $('#flowContainer').innerWidth();
  var minScaleY = $('#flowContainer').innerHeight();
  let $panzoom = $('#canvas').panzoom({
    minScale: 0.5,
    increment: 0.2
  });

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

  function getCurrentWindow() {
    let el = null;
    $('.sourceWindow').each(function(i, element) {
      let elName = element.lastChild.firstChild.innerHTML;
      if (elName == $('#pipeName').text()) {
        el = element;
      }
    });
    return el;
  }

  jsPlumb.fire("jsPlumbDemoLoaded", instance);


  /*
   * one function to modify the flow and code at the same time.
   * @param change: insert here the action you want to do.
   * @param callback: insert an object with necessary information.
   */
  function modifyFlow(change, obj) {
    switch (change) {
      case 'add':
        newPipe = addPipe('CustomPipe', {
          x: 100,
          y: 100
        });
        changeAddPipe(newPipe, {
          x: 100,
          y: 100
        });
        break;
      case 'edit':
        let oldTitle = obj.innerHTML;
        let newTitle = prompt("What is the new Title?", oldTitle);
        if (newTitle != null) {
          obj.innerHTML = newTitle;
          changeName(oldTitle, newTitle);
        }
        break;
      case 'connection':
        adding = true;
        changeAddForward(obj.source, obj.target);
        adding = false;
        break;
      case 'drag':
        changePossition(obj.name, obj.x.replace(/px/, ''), obj.y.replace(/px/, ''));
        break;
      case 'dragExit':
    	changeExitPossition(obj.name, obj.x.replace(/px/, ''), obj.y.replace(/px/, ''));
    	break;
      case 'delete':
        deleteForward(obj.name, obj.target);
        break;
    }
  }

  function toggleConnectorType() {
    if (connectorType === "Flowchart") {
      connectorType = "StateMachine";
    } else {
      connectorType = "Flowchart";
    }
    generateFlow();
  }

  // a function to put distance between the pipes
  function setOffsets(possitions) {
    let boxOffset = 0;
    let container = null;

    moving = true;
    for (let i = 1; i <= windows; i++) {
      boxOffset += 250;
      if (!possitions) {
        box = $('#sourceWindow' + i);
        if (!horizontalBuild) {
          box.css("top", boxOffset + "px");
        } else {
          box.css("top", "100px");
          box.css("left", boxOffset + "px");
        }
        modifyFlow('drag', {
          name: box[0].lastChild.firstElementChild.textContent,
          x: box.css("left"),
          y: box.css("top")
        })
      }
      let totalLength, windowLength;
      if (!horizontalBuild) {
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
    moving = false;
  }

  function getTypeImage(name) {
    types = getTypes();
    let img, url;
    if (types[name] != null) {

      switch (types[name]) {
        case 'newPipe':
          url = 'media/basicPipe.png';
          break;
        case 'DelayPipe':
          url = 'media/delayPipe.png';
          break;
        case 'SenderPipe':
          url = 'media/senderPipe.png';
          break;
        case 'XmlIfPipe':
          url = 'media/xmlIfPipe.png';
          break;
        case 'XmlSwitchPipe':
          url = 'media/switchPipe.png';
          break;
        case 'XsltPipe':
          url = 'media/xsltPipe.png';
          break;
        case 'JsonPipe':
          url = 'media/jsonPipe.png';
          break;
        case 'FixedResultPipe':
          url = 'media/resultPipe.png';
      }
      if (url != null) {
        img = $('<img></img>').attr({
          src: url,
          alt: types[name],
          title: types[name]
        }).addClass("typeImg");
        return img;
      }
    }
    url = 'media/basicPipe.png';
    img = $('<img></img>').attr({
      src: url,
      alt: types[name],
      title: types[name]
    }).addClass("typeImg");
    return img;
  }

  /*
  # function to manually add a Pipe
  # increment windows and create div
  # make element a source and a target
  # bind to connection
  */

  function addPipe(name = "pipe" + (windows), possitions, extra = "", isExit) {
    let id = windows += 1;
    let canvas = $('#canvas');
    let el = $("<div></div>").addClass("window sourceWindow").attr("id", "sourceWindow" + id);
    let typeText = $("<strong></strong>").attr("id", "strong").text(getTypes()[name]);
    let typeWindow = $('<div></div>').addClass("typeWindow").append(getTypeImage(name), typeText);
    let bottomContainer = $('<div></div>').addClass("bottomContainer");
    let nameText = $("<strong></strong>").attr("id", "strong").text(name);
    let hr = $('<hr>');
    let extraText = $("<strong></strong>").attr("id", "strong").text(extra);
    isExit ? bottomContainer.append(nameText, extraText) : bottomContainer.append(nameText, hr, extraText);
    el.append(typeWindow, bottomContainer);
    if (possitions != null) {
      $(el).css('left', possitions.x + 'px');
      $(el).css('top', possitions.y + 'px');
    }
    if (isExit) {
      $(el).addClass('exit');
    }
    instance.makeSource(el, {
      filter: ".enableDisableSource",
      filterExclude: true,
      maxConnections: -1,
      endpoint: ["Dot", {
        radius: 7,
        cssClass: "small-blue"
      }],
      anchor: sourceAnchors,
      connector: [connectorType, {
        stub: [40, 60],
        gap: 10,
        cornerRadius: 5,
        alwaysRespectStubs: true,
        midpoint: 0.0001
      }]
    });

    instance.makeTarget(el, {
      dropOptions: {
        hoverClass: "hover"
      },
      anchor: ["Left", "Top", "Right"],
      endpoint: ["Dot", {
        radius: 11,
        cssClass: "large-green"
      }]
    });
    canvas.append(el);
    return name;
  }
  
  function addExits(exits) {
	  let exit = exits,
	  possitions,
	  name,
	  ypos,
	  xpos;
	  if(exit == null) {
		  return;
	  }
	  if(Array.isArray(exit)) {
		  exit.forEach(function (item, index) {
			  name = exit[index]['@path'],
			  xpos = exit[index]['@x'],
			  ypos = exit[index]['@y'];
	          if (xpos != null && ypos != null) {
	              possitions = {
	                x: xpos,
	                y: ypos
	              }
	         }
	         addPipe(name, possitions, "", true);
		  });
	  } else {
		  name = exit['@path'],
		  xpos = exit['@x'],
		  ypos = exit['@y'];
          if (xpos != null && ypos != null) {
              possitions = {
                x: xpos,
                y: ypos
              }
         }
         addPipe(name, possitions, "", true);
	  }
  }

  /*
  # if the pipeline is not null empty the canvas
  # for pipe is not null generate each pipe
  # if there is only one pipe only generate that one
  # push all forwards to the forwards array and generate the forwards
  */
  function generateFlow() {
    windows = 0;
    let possitions = null;
    let transformedXml = convertConfiguration();
    if (transformedXml != null && transformedXml.Adapter != null &&
      transformedXml.Adapter.Pipeline != null) {
      instance.reset();
      $('#canvas').empty();
      if (transformedXml.Adapter.Pipeline.pipe != null) {
        $('#canvas').text("Adapter: " + transformedXml.Adapter['@name']);
        let pipe = transformedXml.Adapter.Pipeline.pipe;
        let forwards = [];
        if (Array.isArray(pipe)) {
          for (p in pipe) {
            let name = pipe[p]['@name'],
              xpos = pipe[p]['@x'],
              ypos = pipe[p]['@y'],
              extraText = "";
            if (xpos == null && ypos != null) {
              xpos = ypos;
            } else if (ypos == null && xpos != null) {
              ypos = xpos;
            }
            if (xpos != null && ypos != null) {
              possitions = {
                x: xpos,
                y: ypos
              }
            }
            if(pipe[p]['@xpathExpression'] != null) {
              extraText = pipe[p]['@xpathExpression'].slice(0, 15) + '...';
            } else if(pipe[p].FixedQuerySender != null && pipe[p].FixedQuerySender['@query'] != null) {
              extraText = pipe[p].FixedQuerySender['@query'].slice(0, 15) + '...';
            }
            addPipe(name, possitions, extraText);
            if (pipe[p].Forward != null) {
              let forwardData = null;
              if (Array.isArray(pipe[p].Forward)) {
                pipe[p].Forward.forEach(function(item, index) {
                  forwardData = {
                    sourcePipe: name,
                    targetPipe: item['@path'],
                    name: item['@name']
                  };
                  forwards.push(forwardData);
                });
              } else {
                forwardData = {
                  sourcePipe: name,
                  targetPipe: pipe[p].Forward['@path'],
                  name: pipe[p].Forward['@name']
                };
                forwards.push(forwardData);
              }
            } else {
              let nextPipe = parseInt(p) + 1;
              if (pipe[nextPipe] != null) {
                forwardData = {
                  sourcePipe: name,
                  targetPipe: pipe[nextPipe]['@name'],
                  name: "success"
                }
                forwards.push(forwardData);
              }
            }
          }
        } else {
            let name = pipe['@name'];
            addPipe(name);
            if (pipe.Forward != null) {
              let forwardData = null;
              if (Array.isArray(pipe.Forward)) {
                pipe.Forward.forEach(function(item, index) {
                  forwardData = {
                    sourcePipe: name,
                    targetPipe: item['@path'],
                    name: item['@name']
                  };
                  forwards.push(forwardData);
                });
              } else {
                forwardData = {
                  sourcePipe: name,
                  targetPipe: pipe.Forward['@path'],
                  name: pipe.Forward['@name']
                };
                forwards.push(forwardData);
              }
            }
          }
          addExits(transformedXml.Adapter.Pipeline.Exit);
        if (possitions === null) {
          setOffsets(false);
        } else {
          setOffsets(true);
        }
        if (transformedXml.Adapter.Receiver != null) {
          addPipe('(receiver): ' + transformedXml.Adapter.Receiver['@name'], {
            x: "600",
            y: "400"
          });
          let forwardData = {
            sourcePipe: '(receiver): ' + transformedXml.Adapter.Receiver['@name'],
            targetPipe: forwards[0].sourcePipe,
            name: 'request'
          };
          forwards.push(forwardData);
        }
        generateForwards(forwards);
      }
    } else {
      displayError(transformedXml);
    }
  }

  /*
  # a function to search all of the forwards in the transformed json.
  # bind to each connection and update code editor.
  # connect all of the pipes according to the forwards given in this method.
  # @param forwards: a json object with all of the forwards.
  */
  function generateForwards(forwards) {
    //when generating set to true and after generating to false.
    let generated = true;

    instance.bind("connection", function(i, c) {
      let counter = 0;
      instance.getAllConnections().forEach(function(conn) {
        if (conn.sourceId == i.connection.sourceId && conn.targetId == i.connection.targetId) {
          if (counter < 2) {
            counter++;
          }
        }
      });

      let source = i.sourceEndpoint.element.lastChild.firstElementChild.textContent;
      let target = i.targetEndpoint.element.lastChild.firstElementChild.textContent;
      i.connection.bind("dblclick", function(conn) {
        instance.deleteConnection(conn);
        modifyFlow('delete', {
          name: source,
          target: target
        });
      })
      //connection already exists so delete the first connection.
      if (counter > 1) {
        instance.getAllConnections().some(function(conn) {
          if (conn.sourceId == i.connection.sourceId && conn.targetId == i.connection.targetId) {
            instance.deleteConnection(conn);
            return true;
          }
        });
        return;
      }

      if (!generated) {
        modifyFlow('connection', {
          source: source,
          target: target
        });
      }
    });

    //loop over and connect the forwards.
    let sourcePipe = "";
    let targetPipe = "";
    generated = true;
    $(forwards).each(function(index, f) {
      sourcePipe = "";
      targetPipe = "";
      if (f.targetPipe == null) {
        f.targetPipe = f.name;
      }
      $(".sourceWindow").each(function(i, element) {
        var $element = $(element)[0];
        let refactoredText = $element.lastChild.firstChild.innerHTML;
        if (refactoredText == f.sourcePipe) {
          sourcePipe = $($element).attr('id');
        } else if (refactoredText == f.targetPipe) {
          targetPipe = $($element).attr('id');
        }
      });
      let paintStyle = {
        stroke: "#000000",
        strokeWidth: 3
      }
      if (f.name == 'failure' || f.name == 'exception') {
        paintStyle.stroke = "#FF0000";
      } else if (f.name == 'success') {
        paintStyle.stroke = "#22bb33"
      } else if (f.name == "request" || f.name == 'response') {
        paintStyle.dashstyle = "2 4";
      }
      if (sourcePipe != "" && targetPipe != "") {
        let con = instance.connect({
          source: sourcePipe,
          target: targetPipe,
          paintStyle: paintStyle,
          overlays: [
            ["Label", {
              label: f.name,
              id: "label",
              location: 0.1,
              padding: 100
            }]
          ],
          connector: [connectorType, {
            stub: [40, 60],
            gap: 10,
            cornerRadius: 5,
            alwaysRespectStubs: true,
            midpoint: 0.0001
          }]
        });
      }
    });
    generated = false;
  }

  function displayError(e) {
    instance.reset();
    $('#canvas').empty();
    $('#canvas').css('display', 'none');
    $('.customErrorMessage').remove();
    $('#flowContainer').append($("<h1></h1>").text('Error' + e).addClass('customErrorMessage'));
  }

  let changeCount = 0;
  editor.getModel().onDidChangeContent(function(e) {
    changeCount++;
    if (!moving && changeCount >= 1 && !adding) {
      try {
        changeCount = 0;
        $('#canvas').css('display', 'block');
        $('.customErrorMessage').remove();
        generateFlow();
        // if(editor.getModel().getValue() == "") {
        //   undoDecorations();
        // }
      } catch (error) {
        console.log("error", error);
        displayError(error);
      }
    }
  })
});
