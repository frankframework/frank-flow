import CodeView from '../View/codeView/CodeView.js';
import FileTreeView from '../View/codeView/FileTreeView.js';
import FileService from '../services/FileService.js';
import XsdModel from '../Model/XsdModel';
import * as beautify from 'vkbeautify';
import XsdService from '../services/XsdService.js';
import IbisdocService from '../services/IbisdocService.js';
import FileModel from '../Model/FileModel.js';

export default class CodeController {

  constructor(mainController, ibisdocModel) {
    this.mainController = mainController;

    this.xsdModel = new XsdModel();
    this.ibisdocModel = ibisdocModel;
    this.fileModel = new FileModel();

    this.codeView = new CodeView(this.xsdModel);
    this.fileModel.addListener(this)
    this.codeView.addListener(this);

    this.fileService = new FileService(this);
    this.xsdService = new XsdService(this.xsdModel);
    this.ibisdocService = new IbisdocService(this.ibisdocModel, this.codeView);

    this.fileService.getConfigurations();
    this.xsdService.getXsd();
    this.ibisdocService.getIbisdoc();

    this.codeView.makeEditor();
    this.editor = this.codeView.editor;

    this.fileTreeView = new FileTreeView(this.editor, this.fileService);
    this.initListeners();
  }


  //_______________Event handlers_______________

  initListeners() {
    let cur = this;

    $.contextMenu({
      selector: '.folder',
      zIndex: 3001,
      callback: function (key, options) {
        var m = "clicked: " + key;
        alert(m);
        return true;
      },
      items: {
        "addFile": {
          name: "Add a file", icon: "fas fa-file",
          callback: function () {
            const path = $(this).attr('data-name');
            cur.fileTreeView.addFile(path);
            return true;
          }
        },
        "addFolder": {
            name: "Add folder", icon: "fas fa-folder",
            callback: function() {
              const name = prompt("Folder name");
              const root = $(this).attr('data-name');
              console.log("Add a folder", root + "/" + name);

              cur.fileTreeView.addFolder(root, name);
              return true;
            }
          }
      }
    });

    $.contextMenu({
      selector: '.file',
      zIndex: 3001,
      callback: function (key, options) {
        var m = "clicked: " + key;
        alert(m);
        return true;
      },
      items: {
        "rename": {
          name: "Rename file", icon: "fas fa-file",
          callback: function () {
            const name = $(this).attr('data-name'),
                  newName = prompt('Rename file', name);

            if(newName == "" || newName == null) {
              return;
            }
            
            let root = cur.fileTreeView.replaceEncodings($(this).attr('data-id'));
            let innerRoot = root.match(/^[^]*?(?=\/)/g)

            if(innerRoot == null) {
              cur.fileTreeView.renameFile(root, name, newName);
            } else {
              path = deployableUnit.replace(root, '') + '/' + path;

              cur.fileTreeView.renameFile(innerRoot[0], name, newName);
            }


            return true;
          }
        },
        "delete": {
          name: "Delete file", icon: "fas fa-trash",
          callback: function () {
            const name = $(this).attr('data-name'),
                  root = $(this).attr('data-id'),
                  currentDir = localStorage.getItem('currentFileRoot');
            cur.fileTreeView.deleteFile(root, name);
            return true;
          }
        }
      }
    });

    $('#adapterSelect').on('change', function (e) {
      const adapterName = $('#adapterSelect').val();
      localStorage.setItem('currentAdapter', adapterName)
      cur.quickGenerate();

    });


    $('#saveFile').on('click', function (e) {
      cur.fileTreeView.saveFile();
    })

    $('#beautify').click(function () {
      let prettyXML = beautify.xml(cur.editor.getValue(), 4);
      cur.editor.getModel().setValue(prettyXML);
    });

    $('#addFile').click(function () {
      const currentFileRoot = '> ' + localStorage.getItem('currentFileRoot');
      cur.fileTreeView.addFile(currentFileRoot);
    })


    cur.editor.onMouseDown(function (e) {
      e.target.range.startLineNumber = 1;
      e.target.range.startColumn = 1;

      const textPossition = cur.editor.getModel().getValueInRange(e.target.range),
            adapters = textPossition.match(/<Adapter[^]*?name=".*?">/g);

      if (adapters != null) {
        let adapterName = adapters[adapters.length - 1].match(/name="[^]*?"/g)[0].match(/"[^]*?"/g)[0].replace(/"/g, '');

        if (localStorage.getItem("currentAdapter") !== adapterName) {
          localStorage.setItem("currentAdapter", adapterName);
          cur.quickGenerate();
        }
      }
    })


    this.editor.getModel().onDidChangeContent(cur.debounce(function () {
      cur.quickGenerate()
    }, 250))

    $('#runXsd').click(function () {
      let validate = cur.validateConfiguration(),
        lineNumber = 0;
      cur.undoDecorations();
      if (validate.errors !== null) {
        validate.errors.forEach(function (item, index) {
          lineNumber = item.match(/:.*?:/)[0].replace(/:/g, '');
          cur.decorateLine(lineNumber);
        });
      }
    })
  }

  //_______________Custom methods to be called from handlers_______________

  quickGenerate() {
    let cur = this;
    if (!cur.mainController.flowController.flowView.moving && !cur.mainController.flowController.flowView.adding) {
      try {
        $('#canvas').css('display', 'block');
        $('.customErrorMessage').remove();
        cur.mainController.generateFlow();
      } catch (error) {
        cur.mainController.flowController.flowView.modifyFlow("error", error);
      }
    }
  }

  debounce(func, wait, immediate) {
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


  //_______________Methods for modifying the editor_______________

  setEditorValue(value) {
    this.codeView.setEditorValue(value);
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
  deletePipe() {
    this.codeView.codePipeView.deletePipe()
  }
}
