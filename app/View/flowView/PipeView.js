import DescriptionView from './DescriptionView.js';
import TypeImageView from './TypeImageView.js';

export default class PipeView {

  constructor(flowView) {
    this.flowView = flowView;
    this.descriptionView = new DescriptionView();
    this.typeImageView = new TypeImageView(flowView);
  }

  /*
  # function to manually add a Pipe/Exit
  # increment windows and create div
  # make element a source and a target
  # bind to connection
  */

  addPipe(name, possitions, extra, isExit, descText) {
    //make all html elements
    let flowView = this.flowView,
      id = flowView.windows += 1,
      canvas = $('#canvas'),
      el = $("<div></div>").addClass("window sourceWindow").attr("id", "sourceWindow" + id),
      typeText = $("<strong></strong>").attr("id", "strong").text(flowView.getTypes()[name]),
      typeWindow = $('<div></div>').addClass("typeWindow").append(this.getTypeImage(name), typeText),
      bottomContainer = $('<div></div>').addClass("bottomContainer"),
      nameText = $("<strong></strong>").attr("id", "strong").text(name),
      hr = $('<hr>'),
      extraText = $("<strong></strong>").attr("id", "strong").text(extra);

    //if isExit is true then don't append the hr tag.
    isExit ? bottomContainer.append(nameText, extraText) : bottomContainer.append(nameText, hr, extraText);

    el.append(typeWindow, bottomContainer);
    if (possitions != null) {
      $(el).css('left', possitions.x + 'px');
      $(el).css('top', possitions.y + 'px');
      if (descText) {
        this.descriptionView.addDescription(descText, possitions, id);
      }
    }

    this.makeInteractive(el, isExit);
    canvas.append(el);

    //if there is an description then connect the description.
    if (descText) {
      instance.connect({
        source: "sourceWindow" + id,
        target: "description" + id
      });
    }
    return name;
  }

  makeInteractive(el, isExit) {
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

    if (isExit) {
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
          alwaysRespectStubs: true,
          midpoint: 0.0001
        }]
      });
    }
  }

  getTypeImage(name, paletteImg) {
    return this.typeImageView.getTypeImage(name, paletteImg);
  }
}
