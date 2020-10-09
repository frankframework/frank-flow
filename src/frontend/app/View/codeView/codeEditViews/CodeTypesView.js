export default class CodeTypesView {
  constructor(editor) {
    this.editor = editor;
  }

  //gives back the types of pipes with the name of the pipe.
  getTypes() {
    let types = {},
      value = this.editor.getValue(),
      occurences = value.match(/<[\S]*?[^"/][pP]ipe[\s\t\n][^]*?>[^]*?<[/][\S]*?[^"/]Pipe>/g),
      name,
      type = null;
    let receiver = value.match(/<Receiver[^]*?name=".*?"[^]*?>/g);
    if (receiver != null) {
      receiver = receiver[0].match(/".*?"/g)[0].replace(/"/g, '');
    } else {
      receiver = 'NO_RECEIVER_FOUND'
    }
    types['receiver ' + receiver] = "Receiver";
    occurences.forEach(function(item, index) {
      item = item.replace(/</g, '')
      if (item.search(/[^/][\S]*?[^"/]Pipe[^]*?name=".*?"/) > -1) {
        if (item.charAt(0) != '/') {
          let tag = item.slice(item.search(/[^/][\S]*?[^"/]Pipe[^]*?name=".*?"/));
          if (tag.match(/name=".*?"/) != null) {
            name = tag.match(/name=".*?"/)[0].match(/".*?"/)[0].replace(/"/g, '');
          }
          if (tag.match(/[^]*?Pipe/) != null) {
            type = tag.match(/[^]*?Pipe/)[0];
          }
          if (item.match(/[^<>]*?Sender(?!Pipe) /g) != null) {
            type = item.match(/[^<>]*?Sender(?!Pipe) /g)[0];
          }
          if (type !== null && name !== null) {
            types[name] = type;
          }
        }
      }
    })
    return types;
  }
}
