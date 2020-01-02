import DescriptionView from './DescriptionView.js';

export default class PipeView {

  constructor(flowView) {
    this.flowView = flowView;
    this.descriptionView = new DescriptionView();
  }

  /*
  # function to manually add a Pipe
  # increment windows and create div
  # make element a source and a target
  # bind to connection
  */

  addPipe(name, possitions, extra, isExit, descText) {
    let flowView = this.flowView;
    let id = flowView.windows += 1;
    let canvas = $('#canvas');
    let el = $("<div></div>").addClass("window sourceWindow").attr("id", "sourceWindow" + id);
    let typeText = $("<strong></strong>").attr("id", "strong").text(flowView.getTypes()[name]);
    let typeWindow = $('<div></div>').addClass("typeWindow").append(this.getTypeImage(name), typeText);
    let bottomContainer = $('<div></div>').addClass("bottomContainer");
    let nameText = $("<strong></strong>").attr("id", "strong").text(name);
    let hr = $('<hr>');
    let extraText = $("<strong></strong>").attr("id", "strong").text(extra);
    isExit ? bottomContainer.append(nameText, extraText) : bottomContainer.append(nameText, hr, extraText);
    el.append(typeWindow, bottomContainer);
    if (possitions != null) {
      $(el).css('left', possitions.x + 'px');
      $(el).css('top', possitions.y + 'px');
      if(descText) {
        this.descriptionView.addDescription(descText, possitions, id);
      }
    }
    
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

    canvas.append(el);
    if(descText) {
    instance.connect({source: "sourceWindow" + id, target: "description" + id});
    }
    return name;
  }

  getTypeImage(name, paletteImg) {
    let types = this.flowView.getTypes(),
      img,
      testImage = new Image(),
      url;
      if(paletteImg) {
        url = 'media/' + name + '.png';
      } else {
      url = 'media/' + types[name] + '.png';
      }
    if (url != null) {
      img = $('<img></img>').attr({
        src: url,
        alt: types[name],
        title: types[name]
      }).addClass("typeImg");
      testImage.src = url;
      testImage.onerror = function() {
        img.attr('src', 'media/basicPipe.png');
      }
      return img;
    }
  }
}
