import DescriptionView from '../DescriptionView.js';
import TypeImageView from '../TypeImageView.js';
import PipeModel from '../../../Model/PipeModel.js';

export default class PipeView {

  constructor(flowView, name, possitions, extra, isExit, descText) {
    this.flowView = flowView;
    this.descriptionView = new DescriptionView();
    this.typeImageView = new TypeImageView(flowView);
    this.types = this.flowView.getTypes();

    this.pipeModel = new PipeModel(name, possitions, extra, isExit, descText, this.types[name])

    this.flowView.notifyListeners({ type: "getPipeAttributes", name: name, pipeModel: this.pipeModel });

    this.name = name;
    this.possitions = possitions;
    this.extra = extra;
    this.isExit = isExit;
    this.descText = descText;

    this.element = null;

    if(this.flowView != null) {
    this.addPipe();
    }
  }

  addPipe() {
    let flowView = this.flowView,
      id = flowView.windows += 1,
      canvas = $('#canvas'),
      el = $("<div></div>").addClass("window sourceWindow").attr("id", "sourceWindow" + id),
      bottomContainer = $('<div></div>').addClass("bottomContainer");

    el = this.checkForExitOrReceiver(el, bottomContainer);
    this.addDescription(id, el);
    this.makeInteractive(el);
    canvas.append(el);

    this.connectDescription(id);
    //return name;
  }

  checkForExitOrReceiver(el, bottomContainer) {
    let typeText = $("<strong></strong>").attr("id", "strong").text(this.types[this.name]),
        typeWindow = $('<div></div>').addClass("typeWindow").append(this.getTypeImage(), typeText),
        nameText = $("<strong></strong>").attr("id", "strong").text(this.name),
        hr = $('<hr>'),
        extraText = $("<strong></strong>").attr("id", "strong").text(this.extra);

    this.isExit ? bottomContainer.append(nameText, extraText) : bottomContainer.append(nameText, hr, extraText);

    if (this.isExit | this.types['receiver ' + this.name.replace('(receiver): ', '')] === "Receiver") {
      el.append(bottomContainer);
    } else {
      el.append(typeWindow, bottomContainer);
    }

    if(this.isExit) {
      this.pipeModel.type = "Exit";
    } else if (this.types['receiver ' + this.name.replace('(receiver): ', '')] === "Receiver") {
      this.pipeModel.type = "Receiver";
    }

    return el;
  }

  addDescription(id, el) {
    if (this.possitions != null) {
      $(el).css('left', this.possitions.x + 'px');
      $(el).css('top', this.possitions.y + 'px');
      if (this.descText) {
        this.descriptionView.addDescription(this.descText, this.possitions, id);
      }
    }
  }

  connectDescription(id) {
    if (this.descText) {
      instance.connect({
        source: "sourceWindow" + id,
        target: "description" + id
      });
    }
  }

  makeInteractive(el) {
    let flowView = this.flowView;
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

    if (this.isExit) {
      $(el).addClass('exit');
    } else {
      instance.makeSource(el, {
        filter: ".enableDisableSource",
        filterExclude: true,
        maxConnections: -1,
        endpoint: ["Dot", {
          radius: 7,
          cssClass: "small-blue"
        }],
        anchor: flowView.sourceAnchors,
        connector: [flowView.connectorType, {
          stub: [40, 60],
          gap: 10,
          cornerRadius: 5,
          midpoint: 0.0001
        }]
      });
    }
  }

  getTypeImage() {
    return this.typeImageView.getTypeImage(this.pipeModel.type);
  }
}
