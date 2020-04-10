import CodeEditView from './CodeEditView.js';
import { css } from 'vkbeautify';

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

    /**
    check for url param and load configuration with adapter.
    when no url param then load default adapter.

    definition:
      currentAdapter: this represents the adapter that the user is currently working in.
                      When this variable changes the loaded adapter also changes.
      editor:         This object represents the monaco editor and has all the crud functions necessary to chhange the code.
      focusLine:      This function
    */

    if (urlParams.has('configuration') && urlParams.has('adapter')) {
      console.log(urlParams.get('configuration').replace(/"/g, ''), urlParams.get('adapter'));
      this.editor.setValue(localStorage.getItem("IAF_WebControl"));
      this.editor.setValue(localStorage.getItem(urlParams.get('configuration').replace(/"/g, '')));
      localStorage.setItem('currentAdapter', urlParams.get('adapter').replace(/"/g, ''));
      this.focusLine('<Adapter[^]*? name=' + urlParams.get('adapter') + '[^]*?>');
      this.stripFlow()
    } else {
      localStorage.setItem('currentAdapter', 'WebControlShowConfigurationStatus');
      this.editor.setValue(localStorage.getItem("IAF_WebControl"));
    }
  }

  stripFlow() {
    $('.top-wrapper').css('display', 'none');
    $('#palette').css('display', 'none');
    $('.pipeInfoWrapper').css('display', 'none')
    $('.monaco-flow-wrapper').css('height', '100%')
    $('#canvas').panzoom("zoom", true, 1);
    $('#canvas').panzoom("zoom", true, 1);
    $('#canvas').panzoom("pan", -500, -300);
  }
}
