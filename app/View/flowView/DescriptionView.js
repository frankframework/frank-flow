export default class DescriptionView {

  constructor() {

  }

  addDescription(text, possitions, id) {
    let canvas = $('#canvas');
    let el = $("<div></div>").addClass("description").attr('id', 'description' + id);
    let descriptionText = $('<p></p>').text(text);
    el.append(descriptionText);
    console.log("desc Text:" + text, possitions);
    possitions.x = parseInt(possitions.x) + 300;
    $(el).css('left', possitions.x + 'px');
    $(el).css('top', possitions.y + 'px');
    canvas.append(el);
    instance.draggable(el);
  }
}
