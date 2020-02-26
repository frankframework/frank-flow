import CodeEditView from './CodeEditView.js';

export default class CodeAttributesView extends CodeEditView {
  constructor(editor) {
    super(editor);
    this.getAttributes('doShowConfigurationStatus');
  }

  getAttributes(name) {
    let cur = this,
      attributeObjectRegex = '<[\\S]*?[^"/][pP]ipe[\\s\\t\\n][^>]*?name="' + name + '"[^]*?>',
      returnObj = {},
      matches = this.editor.getModel().findMatches(attributeObjectRegex, false, true, false, false);

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
}
