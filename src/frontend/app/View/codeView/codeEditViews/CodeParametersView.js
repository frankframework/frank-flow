import CodeEditView from './CodeEditView.js';

const PARAMETERREGEX = new RegExp(/<Param[^]*?\/>/, 'g');
const ATTRIBUTEREGEX = new RegExp(/(?=\s)[^]+?\s?=\s?"[^]*?"/, 'g');
const IDREGEX = new RegExp(/[^]*?(?==)/);
const KEYREGEX = new RegExp(/(?==)[^]*/);


export default class CodeParametersView extends CodeEditView {
  constructor(editor) {
    super(editor);
  }

  _getPipe(name) {
    let attributeObjectRegex = window.PIPESREGEX(name),
      matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);

    return matches;
  }

  //returns an array with each parameter as a object.
  getParameters(name) {
    let cur = this,
      returnArr = [],
      matches = this._getPipe(name);

    matches.forEach(function (item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range),
        parameters = pipe.match(PARAMETERREGEX);

      if (parameters !== null) {
        parameters.forEach(function (param, i) {
          let attributes = param.match(ATTRIBUTEREGEX);

          if (attributes !== null) {
            let tempObj = {};
            attributes.forEach(function (attr, i) {    
              attr = attr.replace(/^\s/g, '').replace(/"/g, '').replace(/["\n\r]/g, '');
              let id = attr.match(IDREGEX)[0].replace('[\r\n"]', ''),
                key = attr.match(KEYREGEX)[0].replace('=', '');
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
      parameters = pipe.match(PARAMETERREGEX),
      newParam = '<Param name="' + paramName + '"/>'

    if (parameters == null) {
      parameters = pipe.match(/<\/[^]*?Pipe>/);
    }
    pipe = pipe.replace(
      parameters[parameters.length - 1],
      newParam + '\n\t\t\t\t' + parameters[parameters.length - 1]
    );

    this.edit(matches[0].range, pipe);
  }

  addParameterAttribute(pipeName, paramName, attribute) {
    let cur = this,
      matches = this._getPipe(pipeName);

    matches.forEach(function (item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range),
        parameters = pipe.match(PARAMETERREGEX);

      if (parameters !== null) {
        parameters.forEach(function (param, i) {
          if (param.match('name="' + paramName + '"') != null) {
            let newParam = param.replace(/\/>/, " " + attribute + '=""/>');
            pipe = pipe.replace(param, newParam)
            cur.edit(matches[0].range, pipe);
          }
        })
      }
    }) 
  }

  changeParameterAttribute(pipeName, paramName, attribute, value) {
    let cur = this,
      matches = this._getPipe(pipeName);
      
    matches.forEach(function (item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range),
        parameters = pipe.match(PARAMETERREGEX);

      if (parameters !== null) {
        parameters.forEach(function (param, i) {
          if (param.match('name="' + paramName + '"') != null) {
            let newParam = param.replace(new RegExp(attribute + '="[^]*?"'), attribute + '="' + value + '"');
            pipe = pipe.replace(param, newParam)
            cur.edit(matches[0].range, pipe);
          }
        })
      }
    }) 
  }

  deleteParameter(pipeName, paramName) {
    let cur = this,
      matches = this._getPipe(pipeName),
      pipe = cur.editor.getModel().getValueInRange(matches[0].range),
      param = pipe.match('<Param[^\n]*?name="' + paramName + '"[^]*?/>')
    pipe = pipe.replace(param, '');

    this.edit(matches[0].range, pipe);

  }
}
