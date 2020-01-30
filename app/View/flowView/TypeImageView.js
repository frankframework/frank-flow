export default class TypeImageView {
  constructor(flowView) {
    this.flowView = flowView;
  }

  getTypeImage(name, paletteImg, type) {
    let types = type,
      img,
      testImage = new Image(),
      url;

    if(types == null) {
      types = this.flowView.getTypes();
    }
    if(types[name] != null && types[name].match('Sender') != null) {
      types[name] = 'SenderPipe';
    }
    if (paletteImg) {
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
