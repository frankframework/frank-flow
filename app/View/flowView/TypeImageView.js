export default class TypeImageView {
  constructor(flowView) {
    this.flowView = flowView;
  }

  getTypeImage(name, paletteImg) {
    let types = this.flowView.getTypes(),
      img,
      testImage = new Image(),
      url;
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
