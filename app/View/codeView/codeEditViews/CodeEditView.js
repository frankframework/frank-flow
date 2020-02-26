export default class CodeEditView {
  constructor(editor) {
    this.editor = editor;
  }

  //function to edit the code in the editor.
  edit(range, name) {
    this.editor.executeEdits("monacoContainer", [{
      range: range,
      text: name
    }]);
  }

  //function to focus a line on the editor.
  focusLine(regex) {
    let line = this.editor.getModel().findMatches(regex, false, true, false, false);
    console.log(line, regex);
    console.log(line[0].range);
    this.editor.setSelection(new monaco.Selection(line[0].range.startLineNumber, line[0].range.startColumn, line[0].range.endLineNumber, line[0].range.endColumn));
    this.editor.focus();
    this.editor.revealLineInCenter(line[0].range.startLineNumber);
  }
}
