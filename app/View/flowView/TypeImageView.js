export default class TypeImageView {
  constructor(flowView) {
    this.flowView = flowView;
  }

  getTypeImage(name, type) {
    let types = type,
      img,
      testImage = new Image(),
      url;

    if (types == null) {
      types = this.flowView.getTypes();
    }
    if (types[name] != null && types[name].match('Sender') != null) {
      types[name] = 'SenderPipe';
    }
    url = 'media/images/' + types[name] + '.png';
    if (url != null) {
      img = $('<img></img>').attr({
        src: url,
        alt: types[name],
        title: types[name]
      }).addClass("typeImg");
      testImage.src = url;
      testImage.onerror = function () {
        img.attr('src', 'media/images/basicPipe.png');
      }
      return img;
    }
  }

  getTibcoImage(name) {
    let img,
      testImage = new Image(),
      url,
      types;

    if (types == null) {
      types = this.flowView.getTypes();
    }

    url = 'media/tibcoMode/' + name + '.png';
    console.log(url);

    if (url != null) {
      img = $('<img></img>').attr({
        src: url,
        alt: name,
        title: name
      }).addClass("typeImg");
      testImage.src = url;
      testImage.onerror = function () {
        img.attr('src', 'media/images/basicPipe.png');
      }
      console.log(img)
      return img;
    }
  }
}
