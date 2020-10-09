import CodeEditView from './CodeEditView.js';

export default class ExitPipeView extends CodeEditView {
  constructor(editor) {
    super(editor);
  }

  //change the possitions for the exits
  changeExitPossition(name, newX, newY) {
    let cur = this,
      adapterName = $('#canvas').text().match(/Adapter:\s.*?\s/g)[0].replace(/Adapter:\s/g, '').replace(' ', ''),
      attributeObjectRegex = '<Adapter[^>]*? name="' + localStorage.getItem("currentAdapter") + '"[\\s\\S\\n]*?<Exit [^]*?path="' + name + '"[^]*?\\/>',
      matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);

    matches.forEach(function(item, index) {
      let exit = cur.editor.getModel().getValueInRange(item.range);
      exit = exit.match('<Exit [^>]*?path="' + name + '"[^]*?\\/>')[0];
      if (exit.indexOf('path="' + name + '"') != -1) {
        if (exit.indexOf('x="') != -1) {
          exit = '\t\t' + exit.replace(/x="[0-9]*?"/g, 'x="' + newX + '"')
            .replace(/y="[0-9]*?"/g, 'y="' + newY + '"');
        } else {
          let str = ' x="' + newX + '" y="' + newY + '"'
          exit = '\t\t' + exit.slice(0, exit.indexOf('/')) + str + exit.slice(exit.indexOf('/'));
        }
        item.range.startLineNumber = item.range.endLineNumber;
        cur.edit(item.range, exit);
      }
    });
  }
}
