import JSZip from 'jszip';
import OptionView from './codeEditViews/OptionView.js';
import fileTree from '../../../fileTree/dist/js/file-tree.min.js';

export default class FileTreeView {
  constructor(editor, codeService) {
    this.editor = editor;
    this.codeService = codeService;
    this.fileData = null;
    this.addedFileCounter = 0;
    this.optionView = new OptionView(this.editor);
  }

  makeTree(input) {
    localStorage.removeItem('changedFiles');
    localStorage.removeItem('currentFile');
    $('#fileTreeItems').empty();

    let structure = [];

    input.forEach((item, index) => {
      let obj = {
        id: 'dir' + index,
        name: item,
        type: 'file'
      }
      structure.push(obj);
    });

    //generate the tree.
    $('#fileTreeItems').fileTree({
      data: structure,
      sortable: false,
      selectable: true
    });
    
    this.setSaveFileEventListener();
  }

  setSaveFileEventListener() {
    let cur = this;
    $('.file').on("click", function (e) {
      let path = e.delegateTarget.attributes[3].nodeValue;
      cur.codeService.getSingleFile(path);
    });
  }

  generateAdapters() {
    let currentConfig = localStorage.getItem("currentFile");
    currentConfig = localStorage.getItem(currentConfig)

    let adapters = currentConfig.match(/<Adapter[^]*?>[^]*?<\/Adapter>/g);

    this.optionView.addOptions(adapters);
  }


  addFile(path) {
    const defaultConfig = '<Configuration name="Example1">\n' +
      '\t<Adapter name="Example1Adapter"> \n' +
      '\t\t<Receiver name="Example1Receiver"> \n' +
      '\t\t\t<JavaListener name="Example1" serviceName="Example1" />\n' +
      '\t\t</Receiver>\n' +
      '\t\t<Pipeline firstPipe="Example">\n' +
      '\t\t\t<FixedResultPipe name="Example" returnString="Hello World1">\n' +
      '\t\t\t\t<Forward name="success" path="EXIT"/> \n' +
      '\t\t\t</FixedResultPipe> \n' +
      '\t\t\t<Exit path="EXIT" state="success" /> \n' +
      '\t\t</Pipeline> \n' +
      '\t</Adapter>\n' +
      '</Configuration>\n';

    let addedFileCounter = this.addedFileCounter;

    let obj = {
      id: path + 'newFile' + addedFileCounter, //TODO: add custom id
      name: (path + "newFile" + addedFileCounter),
      type: 'file'
    }

    this.fileData[0].children.push(obj);
    let data = this.fileData;

    this.reloadTree(data)

    localStorage.setItem((path + "newFile" + addedFileCounter), defaultConfig)
    this.zip.file((path + "newFile" + addedFileCounter), defaultConfig);
    this.setSaveFileEventListener();
    this.addedFileCounter++;
  }

  reloadTree(data) {
    $('#fileTreeItems').empty();

    $('#fileTreeItems').fileTree({
      data: data,
      sortable: false,
      selectable: true
    });
  }


  renameFile(path, newPath) {
    let currentFile = localStorage.getItem("currentFile");
    if (currentFile != null) {
      let arr = JSON.parse(localStorage.getItem("changedFiles"));
      let index = arr.indexOf(currentFile);
      if (index > -1) {
        arr.splice(index, 1);
      }
      localStorage.setItem("changedFiles", JSON.stringify(arr));
    }
    localStorage.setItem("currentFile", newPath);

    const fileData = localStorage.getItem(path);
    let prependedPath = path.match(/[^]+\/+/g)[0];
    this.zip.remove(path);
    this.zip.file(prependedPath + newPath, fileData);

    localStorage.removeItem(path);
    localStorage.setItem(prependedPath + newPath, fileData);

    let fileTree = []
    this.prepareFileTree(this.zip, fileTree);
    $('#fileTreeItems').empty();
    this.generateTree(fileTree);
    this.setSaveFileEventListener();
  }

  deleteFile(path) {
    if (path != null) {
      let arr = JSON.parse(localStorage.getItem("changedFiles"));
      let index = arr.indexOf(path);
      if (index > -1) {
        arr.splice(index, 1);
      }
      localStorage.setItem("changedFiles", JSON.stringify(arr));
    }

    localStorage.removeItem(path);
    this.zip.remove(path);

    let fileTree = []
    this.prepareFileTree(this.zip, fileTree);
    $('#fileTreeItems').empty();
    this.generateTree(fileTree);
    this.setSaveFileEventListener();

  }
  // TODO make resisable or not?? 
  // makeFileTreeResizeable() {
  //   let cur = this;
  //   $('#filePaletteWrapper').mousedown(function (e) {
  //     if (parseInt($(this).css('width')) - 10 <= e.offsetX) {
  //       cur.resize = true;
  //     }
  //   });

  //   $('#filePaletteWrapper').mouseup(function (e) {
  //     cur.resize = false;
  //   })

  //   $('#filePaletteWrapper').mousemove(function (e) {
  //     if (parseInt($(this).css('width')) - 10 <= e.offsetX) {
  //       $('#filePaletteWrapper').css('cursor', 'e-resize');
  //     } else {
  //       $('#filePaletteWrapper').css('cursor', 'auto');
  //     }

  //     if (cur.resize) {
  //       $(this).css('width', e.offsetX);
  //     }
  //   });
  // }
}
