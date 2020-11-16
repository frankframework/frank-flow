export default class TypeImageView {
  constructor(flowView) {
    this.flowView = flowView;
  }

  getTypeImage(type) {
    let img,
      testImage = new Image(),
      url;

    if (type == null) {
      type = "basicPipe"
    }
    if (type != null && type.match('Sender') != null) {
      type = 'SenderPipe';
    }
    url = 'media/images/' + type+ '.png';
    if (url != null) {
      img = $('<img></img>').attr({
        src: url,
        alt: type,
        title: type
      }).addClass("typeImg");
      testImage.src = url;
      testImage.onerror = function () {
        img.attr('src', 'media/images/basicPipe.png');
      }
      return img;
    }
  }

  // getTibcoImage(name) {
  //   let img,
  //     testImage = new Image(),
  //     url,
  //     types;

  //   if (types == null) {
  //     types = this.flowView.getTypes();
  //   }

  //   url = 'media/tibcoMode/' + name + '.png';

  //   if (url != null) {
  //     img = $('<img></img>').attr({
  //       src: url,
  //       alt: name,
  //       title: name
  //     }).addClass("typeImg");
  //     testImage.src = url;
  //     testImage.onerror = function () {
  //       img.attr('src', 'media/images/basicPipe.png');
  //     }
  //     return img;
  //   }
  // }
}
