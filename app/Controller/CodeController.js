import CodeModel from '../Model/CodeModel.js';
import CodeView from '../View/codeView/CodeView.js';
import ToBeautifulSyntax from '../View/codeView/ToBeautifulSyntax.js';
import JSZip from '../../node_modules/jszip/dist/jszip.js';
import FileTreeView from '../View/codeView/FileTreeView.js';
import {
  saveAs
} from 'file-saver';
export default class CodeController {

  constructor(mainController) {
    this.mainController = mainController;
    this.codeModel = new CodeModel();
    this.codeView = new CodeView();
    this.codeView.addListener(this);
    this.toBeautiful = new ToBeautifulSyntax();
    this.getXsd();
    this.getIbisdoc();
    this.getConfigurations();
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
    }).then(function(blob) {
      FileSaver.saveAs(blob, "FrankConfiguration");
    })
  }


  initListeners() {
    let cur = this;
    $('#adapterSelect').on('change', function(e) {
      let adapter = $('#adapterSelect').val();
      console.log(adapter);
      cur.editor.getModel().setValue(localStorage.getItem(adapter));
    });

    $('#fileReader').on('change', function(e) {
      var input = event.target;
      console.log(input.files);
      cur.fileTreeView.makeTree(input, cur.editor);

    });


    $('#uploadFile').on('click', function(e) {
      cur.saveFile();
    })

    $('#adapterSelect').on('click', function(e) {
      let adapter = $('#adapterSelect').val();
      localStorage.setItem(adapter, cur.editor.getModel().getValue());
    });

    $('#beautify').click(function() {
      let prettyXML = beautify.xml(cur.editor.getValue(), 4);
      cur.editor.getModel().setValue(prettyXML);
    });

    //generate the adapter with the curren possition of the mouse.
    cur.editor.onMouseDown(function(e) {
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
      return function() {
        var context = this,
          args = arguments;
        var later = function() {
          timeout = null;
          if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
      };
    };

    //when typing, generate the flow.
    this.editor.getModel().onDidChangeContent(debounce(function() {
      cur.quickGenerate()
    }, 250))

    //run the xsd to the xml that is currently in the editor
    $('#runXsd').click(function() {
      let validate = cur.validateConfiguration(),
        lineNumber = 0;
      cur.undoDecorations();
      if (validate.errors !== null) {
        console.log(validate.errors);
        validate.errors.forEach(function(item, index) {
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
        // if(editor.getModel().getValue() == "") {
        //   undoDecorations();
        // }
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


  getIbisdoc() {
    let cur = this;
    fetch('../rest/ibisdoc/ibisdoc.json', {
        method: 'GET'
      })
      .then(response => {
        return response.json()
      })
      .then(data => {
        // Work with JSON data here
        cur.codeView.ibisdocJson = data;
        cur.mainController.setPipes(data);
      })
      .catch(err => {
        // Do something for an error here
        console.log("couldn't load ibisdoc, now switching to default ibisdoc");
        this.getDefaultIbisdoc();
      })

  }

  getDefaultIbisdoc() {
    let cur = this;
    fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.json', {
        method: 'GET'
      })
      .then(response => {
        return response.json()
      })
      .then(data => {
        // Work with JSON data here
        cur.codeView.ibisdocJson = data;
        cur.mainController.setPipes(data);
      })
      .catch(err => {
        // Do something for an error here
        console.log(err);

      })
  }

  getXsd() {
    fetch('../rest/ibisdoc/ibisdoc.xsd', {
        method: 'GET'
      })
      .then(response => {
        return response.text()
      })
      .then(data => {
        // Work with JSON data here
        localStorage.setItem("ibisdocXsd", data);
        console.log("xsd is loaded!, here");
      })
      .catch(err => {
        console.log("couldn't load xsd, now loading deafult xsd", err);
        this.getDefaultXsd();
        // Do something for an error here
      })
  }

  getDefaultXsd() {
    fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.xsd', {
        method: 'GET'
      })
      .then(response => {
        return response.text()
      })
      .then(data => {
        // Work with JSON data here
        localStorage.setItem("ibisdocXsd", data);
        console.log("xsd is loaded!, here");
      })
      .catch(err => {
        console.log("not loaded xsd", err);
        // Do something for an error here
      })
  }

  getConfigurations(secondTry) {
    let cur = this,
      path = '../iaf/api/configurations';
    if (secondTry) {
      path = '../' + path;
    }
    fetch(path, {
        method: 'GET'
      })
      .then(response => {
        return response.text();
      })
      .then(response => {
        let configurations = [],
          dom, obj;
        response.match(/<[cC]onfiguration[^]*?>[^]*?<\/[cC]onfiguration>|<IOS-Adaptering[^]*?>[^]*?<\/IOS-Adaptering>/g).forEach(function(item, index) {
          if (item != null) {
            configurations.push(item);
          } else {
            console.log('unknown configuration encountered');
          }
        })

        return configurations;
      })
      .then(response => {
        response.forEach(function(item, index) {
          if (item.match(/<Configuration/g) == null) {
            if (item.match(/IOS-Adaptering/g) != null) {
              item = item.replace(/IOS-Adaptering/g, 'Configuration');
            }
            response[index] = cur.toBeautiful.toBeautifulSyntax(item);
            // let name = item.match(/<configuration[^]*?name=".*?"/g);
            // if (name != null) {
            //   name = name[0].match(/".*?"/g)[0].replace(/"/g, '');
            //   console.log(name);
            //   localStorage.setItem(name, cur.toBeautiful.toBeautifulSyntax(item));
            // } else {
            //   localStorage.setItem(index, cur.toBeautiful.toBeautifulSyntax(item));
            // }
          } else {
            localStorage.setItem(index, item);
          }

        });
        return response;
      })
      .then(data => {
        // Work with JSON data here
        cur.codeView.addOptions(data);
      })
      .catch(err => {
        if (secondTry) {
          console.log('couldnt load configurations', err)
        } else {
          console.log("configurations path was incorrect, trying other path now...", err);
          //cur.getConfigurations(true);
        }
      })
  }
}
