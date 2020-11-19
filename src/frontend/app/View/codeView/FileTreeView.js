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

    console.log("length: " + input.length);
    console.log(input[0]);

    input.forEach((dir, index) => {

      let directoryName = dir.name;
      console.log(directoryName);
      let treeDirectoryObject = {
        id: 'dir' + index,
        name: directoryName,
        type: 'dir',
        children: []
      }

      dir.files.forEach((file, fileIndex) => {
        let treeFileObject = {
          id: directoryName,
          name: file,
          type: 'file'
        }
        //structure.push(treeFileObject);
        treeDirectoryObject.children.push(treeFileObject);
      });


      structure.push(treeDirectoryObject);
    });

    this.fileData = structure;

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
      let currentFile = localStorage.getItem('currentFile'),
          currentFileRoot = localStorage.getItem('currentFileRoot');
      if(currentFile != null && currentFileRoot != null) {
        cur.codeService.addFile(currentFileRoot, currentFile, cur.editor.getValue());
      }

      let path = e.delegateTarget.attributes[3].nodeValue,
      deployableUnit = e.delegateTarget.attributes[1].nodeValue;
      
      console.log(deployableUnit, path);
      localStorage.setItem('currentFile', path);
      localStorage.setItem('currentFileRoot', deployableUnit);
      cur.codeService.getSingleFile(deployableUnit, path);
    });
  }

  generateAdapters() {
    let currentConfig = localStorage.getItem("currentFile");
    currentConfig = localStorage.getItem(currentConfig)

    let adapters = currentConfig.match(/<Adapter[^]*?>[^]*?<\/Adapter>/g);

    this.optionView.addOptions(adapters);
  }


  addFile(root) {

    const name = prompt("File name: ")
    if(name == "") {
      alert('Can\'t make empty file');
      return;
    }

    const defaultConfig = '<Configuration name="' + name + '">\n' +
      '\t<Adapter name="' + name + 'Adapter"> \n' +
      '\t\t<Receiver name="' + name + 'Receiver" x="681" y="24"> \n' +
      '\t\t\t<JavaListener name="' + name + 'Listener" serviceName="' + name + 'Service" />\n' +
      '\t\t</Receiver>\n' +
      '\t\t<Pipeline firstPipe="' + name + 'Pipe">\n' +
      '\t\t\t<FixedResultPipe name="' + name + 'Pipe" returnString="Hello World">\n' +
      '\t\t\t\t<Forward name="success" path="EXIT"/> \n' +
      '\t\t\t</FixedResultPipe> \n' +
      '\t\t\t<Exit path="EXIT" state="success" x="223" y="425"/> \n' +
      '\t\t</Pipeline> \n' +
      '\t</Adapter>\n' +
      '</Configuration>\n';

    const addedFileCounter = this.addedFileCounter,
          newFileName = name;
      

    let obj = {
      id: root, //TODO: add custom id
      name: newFileName,
      type: 'file'
    }
    console.log("ADD FILE: ", root)

    this.fileData.forEach((dir, index) => {
      if(dir.name == root) {
        dir.children.push(obj);
      }
    })
    let data = this.fileData;

    this.reloadTree(data)

    this.codeService.addFile(root, newFileName, defaultConfig);
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

  deleteFile(root, path) {

    console.log(path, this.fileData);
    this.codeService.deleteFile(root, path);

    let newFileData = [];

    this.fileData.forEach((dir, index) => {
      newFileData.push(dir);
      if(root == dir.name) {
        dir.children = dir.children.filter((file) => {
          console.log(file.name != path);
          return file.name != path;
        })
      }
    })

    $('#fileTreeItems').empty();
    $('#fileTreeItems').fileTree({
      data: this.fileData,
      sortable: false,
      selectable: true
    });
    this.setSaveFileEventListener();

  }
}
