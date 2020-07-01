import CodeModel from '../Model/CodeModel.js';
import CodeView from '../View/codeView/CodeView.js';
import JSZip from '../../node_modules/jszip/dist/jszip.js';
import FileTreeView from '../View/codeView/FileTreeView.js';
import CodeService from '../services/CodeService.js';
import {
  saveAs
} from 'file-saver';
export default class CodeController {

  constructor(mainController, ibisdocModel) {
    this.mainController = mainController;
    this.codeModel = new CodeModel();
    this.ibisdocModel = ibisdocModel;
    this.codeView = new CodeView();
    this.codeView.addListener(this);
    this.codeService = new CodeService(this.codeView, ibisdocModel, mainController);
    this.codeView.makeEditor();
    this.editor = this.codeView.editor;
    this.fileTreeView = new FileTreeView(this.editor);
    this.initListeners();
  }


  saveFile() {
    let zip = this.fileTreeView.zip;
    var FileSaver = require('file-saver');
    zip.generateAsync({
      type: "blob"
    }).then(function (blob) {
      FileSaver.saveAs(blob, "FrankConfiguration");
    })
  }


  initListeners() {
    let cur = this;

    $('#adapterSelect').on('change', function (e) {
      let adapter = $('#adapterSelect').val();
      let textConfig = localStorage.getItem(adapter);
      cur.editor.getModel().setValue(textConfig);
      let adapters = textConfig.match(/<Adapter[^]*?name=".*?">/g);
      if (adapters != null) {
        let adapterName = adapters[0].match(/name="[^]*?"/g)[0].match(/"[^]*?"/g)[0].replace(/"/g, '');
        localStorage.setItem("currentAdapter", adapterName);
        cur.quickGenerate();
      }
    });

    $('#fileReader').on('change', function (e) {
      var input = event.target;
      console.log(input.files);
      cur.fileTreeView.makeTree(input, cur.editor);
    });


    $('#uploadFile').on('click', function (e) {
      cur.saveFile();
    })

    $('#adapterSelect').on('click', function (e) {
      let adapter = $('#adapterSelect').val();
      localStorage.setItem(adapter, cur.editor.getModel().getValue());
    });

    $('#beautify').click(function () {
      let prettyXML = beautify.xml(cur.editor.getValue(), 4);
      cur.editor.getModel().setValue(prettyXML);
    });


    cur.editor.onMouseDown(function (e) {
      e.target.range.startLineNumber = 1;
      e.target.range.startColumn = 1;
      let textPossition = cur.editor.getModel().getValueInRange(e.target.range);
      let adapters = textPossition.match(/<Adapter[^]*?name=".*?">/g);
      if (adapters != null) {
        let adapterName = adapters[adapters.length - 1].match(/name="[^]*?"/g)[0].match(/"[^]*?"/g)[0].replace(/"/g, '');
        localStorage.setItem("currentAdapter", adapterName);
        cur.quickGenerate();
      }
    })


    function debounce(func, wait, immediate) {
      var timeout;
      return function () {
        var context = this,
          args = arguments;
        var later = function () {
          timeout = null;
          if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
      };
    };

    this.editor.getModel().onDidChangeContent(debounce(function () {
      cur.quickGenerate()
    }, 250))

    $('#runXsd').click(function () {
      let validate = cur.validateConfiguration(),
        lineNumber = 0;
      cur.undoDecorations();
      if (validate.errors !== null) {
        console.log(validate.errors);
        validate.errors.forEach(function (item, index) {
          lineNumber = item.match(/:.*?:/)[0].replace(/:/g, '');
          cur.decorateLine(lineNumber);
        });
      }
    })
  }

  quickGenerate() {
    let cur = this;
    if (!cur.mainController.flowController.flowView.moving && !cur.mainController.flowController.flowView.adding) {
      try {
        $('#canvas').css('display', 'block');
        $('.customErrorMessage').remove();
        cur.mainController.generateFlow();
      } catch (error) {
        console.log("error", error);
        cur.mainController.flowController.flowView.modifyFlow("error", error);
      }
    }
  }

  selectPipe(name) {
    this.codeView.selectPipe(name);
  }
  getTypes() {
    return this.codeView.getTypes();
  }
  validateConfiguration() {
    return this.codeView.validateConfigurationView.validateConfiguration();
  }
  decorateLine(lineNumber) {
    this.codeView.validateConfigurationView.decorateLine(lineNumber);
  }
  undoDecorations() {
    this.codeView.validateConfigurationView.undoDecorations();
  }
  changeName(oldWord, newWord) {
    this.codeView.changeName(oldWord, newWord);
  }
  changePipeType(name, type, oldType) {
    this.codeView.changePipeType(name, type, oldType);
  }
  changePossition(name, newX, newY) {
    this.codeView.changePossition(name, newX, newY);
  }
  changeExitPossition(name, newX, newY) {
    this.codeView.changeExitPossition(name, newX, newY);
  }
  changeAddForward(name, path) {
    this.codeView.changeAddForward(name, path);
  }
  deleteForward(name, path) {
    this.codeView.deleteForward(name, path);
  }
  changeAddPipe(name, possitions, className) {
    this.codeView.changeAddPipe(name, possitions, className);
  }
  getPipes() {
    return this.codeView.ibisdocJson;
  }
  getAttributes(name) {
    return this.codeView.getAttributes(name);
  }
  getParameters(name) {
    return this.codeView.getParameters(name);
  }
  changeAttribute(pipeName, attribute, attributeValue) {
    this.codeView.changeAttribute(pipeName, attribute, attributeValue);
  }
  addAttribute(pipeName, attribute) {
    this.codeView.addAttribute(pipeName, attribute);
  }
  deleteAttribute(pipeName, attribute) {
    this.codeView.deleteAttribute(pipeName, attribute);
  }
  addParameter(pipeName, paramName) {
    this.codeView.addParameter(pipeName, paramName);
  }
  deleteParameter(pipeName, paramName) {
    this.codeView.deleteParameter(pipeName, paramName);
  }
  addParameterAttribute(pipeName, paramName, attribute) {
    this.codeView.addParameterAttribute(pipeName, paramName, attribute);
  }
  changeParameterAttribute(pipeName, paramName, attribute, value) {
    this.codeView.changeParameterAttribute(pipeName, paramName, attribute, value);
  }

}
