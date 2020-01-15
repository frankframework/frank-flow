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
}
