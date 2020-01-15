export default class OptionView {

  constructor(editor) {
    this.editor = editor;
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
      console.log(urlParams.get('configuration'), urlParams.get('adapter'));
      //this.editor.setValue(localStorage.getItem(urlParams.get('configuration')));
      this.editor.setValue(localStorage.getItem("IAF_WebControl"));
    } else {
      this.editor.setValue(localStorage.getItem("IAF_WebControl"));
    }
  }
}
