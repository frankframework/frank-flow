import CodeEditView from './CodeEditView.js';

export default class CodePipeView extends CodeEditView {

  constructor(editor) {
    super(editor);
  }
  //change the name.
  changeName(oldWord, newWord) {
    let changed = this.changeNameCode('<[\\S]*?[^"/][pP]ipe[^]*?name="\\w*"', oldWord, newWord);
    if (changed) {
      this.changeNameCode('<forward(\\n\\t*)?(\\s\\w*="(\\s?\\S)*"(\\n\\t*)?)*\\/>', oldWord, newWord);
    }
  }

  //change the name of an pipe or forward
  changeNameCode(reg, oldWord, newWord) {
    let cur = this;
    let editor = this.editor;
    let changed = false;
    let attributeObjectRegex = reg;
    let matches = editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    matches.forEach(function(item, index) {
      let pipe = editor.getModel().getValueInRange(item.range);
      if (pipe.split('"').find(word => word === oldWord)) {
        let newPipe = pipe.replace(new RegExp(oldWord, 'g'), newWord);
        changed = true;
        cur.edit(item.range, newPipe);
      }
    });
    return changed;
  }

  //select a pipe.
  selectPipe(name) {
    let cur = this,
      attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>',
      selectPipe = null,
      matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);

    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range);
      if (pipe.match('name="' + name + '"', 'g') !== null) {
        selectPipe = item.range;
      }
    });
    if (selectPipe == null) {
      return selectPipe;
    }
    this.decorations = this.editor.deltaDecorations([], [{
      range: selectPipe,
      options: {
        inlineClassName: 'highlightColor'
      }
    }]);
  }

  //change the class type of a pipe
  changePipeType(name, type, oldType) {
    let cur = this,
      attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>',
      selectPipe = null,
      matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);

    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range);
      if (pipe.match('<' + oldType + '[^]*? name="' + name + '"') !== null) {
        pipe = pipe.replace(new RegExp(oldType, 'g'), type);
        cur.edit(item.range, pipe);
      }
    })
  }

  //change possition for pipes
  changePossition(name, newX, newY) {
    let cur = this;
    let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>|Receiver[\\s\\t\\n][^]*?>';
    let matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    name = name.replace('(receiver): ', '');
    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range);
      if (pipe.match('name="' + name + '"')) {
        let newPipe = "";
        if (pipe.split(/[\s=]/).find(word => word == 'x')) {
          pipe = pipe.replace(new RegExp('x="[0-9]*"', 'g'), 'x="' + newX + '"');
          pipe = pipe.replace(new RegExp('y="[0-9]*"', 'g'), 'y="' + newY + '"');
        } else {
          let str = ' x="' + newX + '" y="' + newY + '"';
          if (pipe.indexOf('/>') != -1) {
            pipe = pipe.slice(0, pipe.indexOf('/')) + str + pipe.slice(pipe.indexOf('/'));
          } else {
            pipe = pipe.slice(0, pipe.indexOf('>')) + str + pipe.slice(pipe.indexOf('>'));
          }
        }
        cur.edit(item.range, pipe);
      }
    });
  }

  //add a forward
  changeAddForward(name, path) {
    let cur = this;
    let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>';
    let matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range);
      if (pipe.split(/[\s>]/).find(word => word === 'name="' + name + '"')) {
        pipe = pipe.slice(0, pipe.search(/<[/][\S]*?[^"/]Pipe/)) + '\t<Forward name="success" path="' + path + '"/>';
        let newLineRange = {
          endColumn: 1,
          endLineNumber: item.range.endLineNumber,
          startColumn: 1,
          startLineNumber: item.range.endLineNumber
        }
        cur.edit(newLineRange, '\n');
        cur.edit(item.range, pipe);
      }
    });
  }

  //delete a forward to an pipe.
  deleteForward(name, path) {
    let cur = this;
    let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>';
    let matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range);
      if (pipe.split(/[\s>]/).find(word => word === 'name="' + name + '"')) {
        path.toLowerCase() == "exit" ? path = "Exit" : path = path;
        let newPipe = pipe.replace(new RegExp('<Forward[^/]*?path="' + path + '"[^]*?/>', 'gi'), "");
        cur.edit(item.range, newPipe);
      }
    });
  }

  // a method to add a pipe by hand.
  changeAddPipe(name, possitions, className = "customPipe") {
    let cur = this;
    let adapterName = $('#canvas').text().match(/Adapter:\s.*?\s/g)[0].replace(/Adapter:\s/g, '').replace(' ', '');
    let attributeObjectRegex = '<Adapter name="' + localStorage.getItem("currentAdapter") + '"[\\s\\S\\n]*?<Exit';
    let matchString = this.editor.getModel().getValue().match(attributeObjectRegex);

    //'<Exit';
    let matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);
    matches.some(function(item, index) {
      let range = item.range;
      range.startColumn = 1;
      range.endColumn = 1;
      range.startLineNumber = range.endLineNumber
      cur.edit(range, '\n');

      let newPipe = '\t\t\t<' + className + ' name="' + name + '" x="' + possitions.x + '" y="' + possitions.y + '">\n\n\t\t\t</' + className + '>\n';
      cur.edit(range, newPipe);
      return true;
    });
  }
}
