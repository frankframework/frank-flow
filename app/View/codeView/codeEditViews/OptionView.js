import CodeEditView from './CodeEditView.js';

export default class OptionView extends CodeEditView {

  constructor(editor) {
    super(editor);
  }

  //add options to the dropdown.
  addOptions(adapters) {
    let urlParams = new URLSearchParams(window.location.search);
    let select = $('#adapterSelect'),
      option,
      name;
    adapters.forEach(function(item, index) {
      name = item.match(/<Configuration[^]*?name=".*?"/g);
      if (name != null) {
        name = name[0].match(/".*?"/g)[0].replace(/"/g, '');
        option = $('<option></option>').attr('value', name).text(name);
        $(select).append(option);

        localStorage.setItem(name, item);
      }
    });
    if (urlParams.has('configuration') && urlParams.has('adapter')) {
      console.log(urlParams.get('configuration').replace(/"/g, ''), urlParams.get('adapter'));
      this.editor.setValue(localStorage.getItem("IAF_WebControl"));
      this.editor.setValue(localStorage.getItem(urlParams.get('configuration').replace(/"/g, '')));
      localStorage.setItem('currentAdapter', urlParams.get('adapter').replace(/"/g, ''));
      this.focusLine('<Adapter[^]*? name=' + urlParams.get('adapter') + '[^]*?>');
    } else {
      this.editor.setValue(localStorage.getItem("IAF_WebControl"));
    }
  }
}
