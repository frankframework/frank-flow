import JSZip from 'jszip';
import OptionView from './codeEditViews/OptionView.js';
import fileTree from '../../../fileTree/dist/js/file-tree.min.js';

export default class FileTreeView {
  constructor(editor, fileService) {
    this.editor = editor;
    this.fileService = fileService;
    this.fileData = null;
    this.optionView = new OptionView(this.editor);
  }

  makeTree(input) {
    localStorage.removeItem('changedFiles');
    localStorage.removeItem('currentFile');

    const structure = [];

    input.forEach((dir, index) => {
      const directoryName = '> ' + dir.name;

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

        treeDirectoryObject.children.push(treeFileObject);
      });

      structure.push(treeDirectoryObject);
    });

    this.fileData = structure;
    this.reloadTree(structure);
    this.setSaveFileEventListener();

    this.getSingleFile(structure[0].name, structure[0].children[0].name);

    localStorage.setItem('currentFileRoot', structure[0].name);
    localStorage.setItem('currentFile', structure[0].children[0].name);

  }

  getSingleFile(root, file) {
    root = this.replaceEncodings(root);
    this.fileService.getSingleFile(root, file);
  }

  replaceEncodings(root) {
    root = root.replace(/> /g, '');
    root = root.replace(/\u2304 /g, '');
    return root;
  }

  setSaveFileEventListener() {
    const cur = this;

    $('.file').on("click", function (e) {

      cur.saveFile();
      let path = e.delegateTarget.attributes[3].nodeValue,
          deployableUnit = e.delegateTarget.attributes[1].nodeValue;

      deployableUnit = cur.replaceEncodings(deployableUnit);

      localStorage.setItem('currentFile', path);
      localStorage.setItem('currentFileRoot', deployableUnit);

      cur.getSingleFile(deployableUnit, path);
    });

    $('.folder').on('click', function (e) {
      const folderElement = $(e.currentTarget);
      let text = $(e.currentTarget.firstElementChild).text();

      if(folderElement.hasClass("mjs-nestedSortable-expanded")) {
        text = text.replace(/> /g, '\u2304 ');
      } else {
        text = text.replace(/\u2304 /g, '> ');
      }
      $(e.currentTarget.firstElementChild).text(text);
    })

  }

  saveFile() {
    const currentFile = localStorage.getItem('currentFile');
    let currentFileRoot = localStorage.getItem('currentFileRoot');

    currentFileRoot = this.replaceEncodings(currentFileRoot);

    if(currentFile != null && currentFileRoot != null) {
      this.fileService.addFile(currentFileRoot, currentFile, this.editor.getValue());
    }
  }

  //TODO: add all adapters of current config to adapter select.
  generateAdapters() {
    const currentConfig = localStorage.getItem("currentFile");
          currentConfig = localStorage.getItem(currentConfig)

    let adapters = currentConfig.match(/<Adapter[^]*?>[^]*?<\/Adapter>/g);

    this.optionView.addOptions(adapters);
  }


  addFile(root) {
    const name = prompt("File name: ");

    if(name == "") {
      alert('Can\'t make empty file');
      return;
    }

    const displayName = name.replace(/\.[^]*/g, '');

    const defaultConfig = '<Configuration name="' + displayName + '">\n' +
      '\t<Adapter name="' + displayName + 'Adapter"> \n' +
      '\t\t<Receiver name="' + displayName + 'Receiver" x="681" y="24"> \n' +
      '\t\t\t<JavaListener name="' + displayName + 'Listener" serviceName="' + displayName + 'Service" />\n' +
      '\t\t</Receiver>\n' +
      '\t\t<Pipeline firstPipe="' + displayName + 'Pipe">\n' +
      '\t\t\t<FixedResultPipe name="' + displayName + 'Pipe" returnString="Hello World">\n' +
      '\t\t\t\t<Forward name="success" path="EXIT"/> \n' +
      '\t\t\t</FixedResultPipe> \n' +
      '\t\t\t<Exit path="EXIT" state="success" x="223" y="425"/> \n' +
      '\t\t</Pipeline> \n' +
      '\t</Adapter>\n' +
      '</Configuration>\n';

      
    //Set object id to root in order to identify the parent folder of the file.
    let obj = {
      id: root,
      name: name,
      type: 'file'
    };

    this.fileData.forEach((dir, index) => {
      if(dir.name == root) {
        dir.children.push(obj);
      }
    });
    let data = this.fileData;

    root = this.replaceEncodings(root);
    this.reloadTree(data);

    this.fileService.addFile(root, name, defaultConfig);
    this.setSaveFileEventListener();
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
    // let currentFile = localStorage.getItem("currentFile");
    // if (currentFile != null) {
    //   let arr = JSON.parse(localStorage.getItem("changedFiles"));
    //   let index = arr.indexOf(currentFile);
    //   if (index > -1) {
    //     arr.splice(index, 1);
    //   }
    //   localStorage.setItem("changedFiles", JSON.stringify(arr));
    // }
    // localStorage.setItem("currentFile", newPath);

    // const fileData = localStorage.getItem(path);
    // let prependedPath = path.match(/[^]+\/+/g)[0];
    // this.zip.remove(path);
    // this.zip.file(prependedPath + newPath, fileData);

    // localStorage.removeItem(path);
    // localStorage.setItem(prependedPath + newPath, fileData);

    // let fileTree = []
    // this.prepareFileTree(this.zip, fileTree);
    // $('#fileTreeItems').empty();
    // this.generateTree(fileTree);
    // this.setSaveFileEventListener();
  }

  deleteFile(root, path) {

    this.fileData.forEach((dir, index) => {
      if(root == dir.name) {

        dir.children = dir.children.filter((file) => {
          return file.name != path;
        })

      }
    })

    root = this.replaceEncodings(root);

    this.fileService.deleteFile(root, path);



    this.reloadTree(this.fileData);
    this.setSaveFileEventListener();

  }
}
