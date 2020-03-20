import CodeEditView from './CodeEditView.js';

export default class CodeParametersView extends CodeEditView{
  constructor(editor) {
    super(editor);
  }

  _getPipe(name) {
    let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^>]*?name="' + name + '"[^]*?>[^]*?<[/][\\S]*?[^"/]Pipe>',
        matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);

    return matches;
  }

  //returns an array with each parameter as a object.
  getParameters(name) {
    let cur = this,
      returnArr = [],
      matches = this._getPipe(name);

    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range),
      parameters = pipe.match(/<Param[^]*?\/>/g);

      if (parameters !== null) {
        parameters.forEach(function(param, i) {
          let attributes = param.match(/(?=\s)[^]+?\s?=\s?"[^]*?"/g);

          if (attributes !== null) {
            let tempObj = {};
            attributes.forEach(function(attr, i) {
              attr = attr.replace(/\s/g, '').replace(/"/g, '');
              let id = attr.match(/[^]*?(?==)/),
              key = attr.match(/(?==)[^]*/)[0].replace('=', '');
              tempObj[id] = key
            })
            returnArr.push(tempObj);
          }
        })
      }
    })
    return returnArr;
  }

  addParameter(pipeName, paramName) {
    let cur = this,
        matches = this._getPipe(pipeName),
        pipe = cur.editor.getModel().getValueInRange(matches[0].range),
        parameters = pipe.match(/<Param[^]*?\/>/g),
        newParam = '<Param name="' + paramName + '"/>'

    if(parameters == null) {
      parameters = pipe.match(/<\/[^]*?Pipe>/);
    }
    pipe = pipe.replace(parameters[parameters.length - 1], newParam + '\n\t\t\t\t' + parameters[parameters.length - 1]);
    this.edit(matches[0].range, pipe);

  }

  deleteParameter(pipeName, paramName) {
      let cur = this,
          matches = this._getPipe(pipeName),
          pipe = cur.editor.getModel().getValueInRange(matches[0].range),
          param = pipe.match('<Param[^\n]*?name="' + paramName +'"[^]*?/>')
          pipe = pipe.replace(param, '');

      this.edit(matches[0].range, pipe);

  }
}
