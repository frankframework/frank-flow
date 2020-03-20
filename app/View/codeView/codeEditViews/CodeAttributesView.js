import CodeEditView from './CodeEditView.js';

export default class CodeAttributesView extends CodeEditView {
  constructor(editor) {
    super(editor);
    this.getAttributes('doShowConfigurationStatus');
  }

  _getPipe(name) {
    let attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^>]*?name="' + name + '"[^]*?>',
      matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);

    return (matches);
  }

  //returns an object with all of the attributes of a pipe.
  getAttributes(name) {
    let cur = this,
      returnObj = {},
      matches = this._getPipe(name);

    matches.forEach(function(item, index) {
      let pipe = cur.editor.getModel().getValueInRange(item.range),
      attributes = pipe.match(/(?=\s)[^]+?\s?=\s?"[^]*?"/g);
      if (attributes !== null) {
        attributes.forEach(function(attr, i) {
          attr = attr.replace(/\s/g, '').replace(/"/g, '');
          let id = attr.match(/[^]*?(?==)/),
          key = attr.match(/(?==)[^]*/)[0].replace('=', '');
          returnObj[id] = key;
        })
      }
    })
    return returnObj;
  }

  changeAttribute(pipeName, attribute, attributeValue) {
    let returnObj = {},
        matches = this._getPipe(pipeName),
        pipe = this.editor.getModel().getValueInRange(matches[0].range),
        attr = pipe.match(attribute + '="[^]*?"'),         //this hold the entire attribute.
        changedAttributeValue = attr[0].replace(/"[^]*?"/g, '"' + attributeValue + '"')         //this holds the entire attribute with an new value.;

      //swap the old with the changed attribute.
      pipe = pipe.replace(attr, changedAttributeValue)
      this.edit(matches[0].range, pipe);
  }

  addAttribute(pipeName, attribute) {
    let matches = this._getPipe(pipeName),
        pipe = this.editor.getModel().getValueInRange(matches[0].range);

    pipe = pipe.replace('>', ' ' + attribute + '="">');
    this.edit(matches[0].range, pipe);
  }

  deleteAttribute(pipeName, attribute) {
    let matches = this._getPipe(pipeName),
        pipe = this.editor.getModel().getValueInRange(matches[0].range);

    let regx = attribute + '="[^]*?"';
    regx = pipe.match(regx)[0];
    pipe = pipe.replace(regx, '');
    this.edit(matches[0].range, pipe);

  }
}
