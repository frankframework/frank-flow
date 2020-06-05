export default class ForwardGenerator {
    constructor(flowModel, flowView) {
        this.flowModel = flowModel;
        this.flowView = flowView;
    }

      /*
  # a function to search all of the forwards in the transformed json.
  # bind to each connection and update code editor.
  # connect all of the pipes according to the forwards given in this method.
  # @param forwards: a json object with all of the forwards.
  */
  generateForwards(forwards) {
    //when generating set to true and after generating to false.
    let generated = true;
    let cur = this;

    this.flowModel.setForwards(forwards);


    //event handler for when a connection is made.
    instance.bind("connection", function (i, c) {
      let counter = 0;
      instance.getAllConnections().forEach(function (conn) {
        if (conn.sourceId == i.connection.sourceId && conn.targetId == i.connection.targetId) {
          if (counter < 2) {
            counter++;
          }
        }
      });


      //bind a double click event for deleting forwards.
      let source = i.sourceEndpoint.element.lastChild.firstElementChild.textContent;
      let target = i.targetEndpoint.element.lastChild.firstElementChild.textContent;
      i.connection.bind("dblclick", function (conn) {
        instance.deleteConnection(conn);
        cur.flowView.modifyFlow('delete', {
          name: source,
          target: target
        });
      })
      //connection already exists so delete the first connection.
      if (counter > 1) {
        instance.getAllConnections().some(function (conn) {
          if (conn.sourceId == i.connection.sourceId && conn.targetId == i.connection.targetId) {
            instance.deleteConnection(conn);
            return true;
          }
        });
        return;
      }

      //check if the connection is generated.
      if (!generated) {
        cur.flowView.modifyFlow('connection', {
          source: source,
          target: target
        });
      }
    });

    //loop over and connect the forwards.
    let sourcePipe = "";
    let targetPipe = "";
    generated = true;
    $(forwards).each(function (index, f) {
      sourcePipe = "";
      targetPipe = "";
      if (f.targetPipe == null) {
        f.targetPipe = f.name;
      }
      $(".sourceWindow").each(function (i, element) {
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
        console.log(sourcePipe, targetPipe)
        instance.connect({
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
          connector: [this.connectorType, {
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
}