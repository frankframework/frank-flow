import JSZip from 'jszip';
import OptionView from './codeEditViews/OptionView.js';
import fileTree from '../../../fileTree/dist/js/file-tree.min.js';

export default class FileTreeView {
  constructor(editor, fileService, xsdModel) {
    this.editor = editor;
    this.fileService = fileService;
    this.fileData = null;
    this.optionView = new OptionView(this.editor);
    this.xsdModel = xsdModel;
  }

  makeTree(input) {
    localStorage.removeItem('changedFiles');
    localStorage.removeItem('currentFile');

    let cur = this;

    const structure = [];

    input.forEach((dir, index) => {

      //Name of the deployable unit
      const directoryName = '> ' + dir.name;

      //Object for file tree representation of deployable unit directory.
      let treeDirectoryObject = {
        id: directoryName,
        name: directoryName,
        type: 'dir',
        children: []
      }

      //Objects for file in deployable unit.
      dir.files.forEach((file, fileIndex) => {
        let treeFileObject = {
          id: directoryName,
          name: file,
          type: 'file'
        }

        if(file.match(/.xsd$/g)) {
          let fileData = cur.getSingleFile(directoryName, file);
          cur.xsdModel.addXsd(file, fileData);
        }

        treeDirectoryObject.children.push(treeFileObject);
      });


      //TODO: make this for loop a different function.
      for (let key in dir) {

        //If the key is not 'files' or 'name' then it is a inner folder.
        //TODO: make a positive return statement.
        if (key != "files" && key != "name") {

          let path = directoryName + "/" + key;
          let previousTreeDirObject = treeDirectoryObject;
          let currentDir = dir[key];
          let currentName = key;
          let treeDirObject;

          while (currentDir) {

            treeDirObject = {
              id: path,
              name: '> ' + currentName,
              type: 'dir',
              children: []
            }

            //Fill dir object with files.
            currentDir._files.forEach(function (file, index) {
              let treeFileObject = {
                id: path,
                name: file,
                type: 'file'
              }

              if(file.match(/.xsd$/g)) {
                let fileData = cur.getSingleFile(directoryName, file);
                cur.xsdModel.addXsd(path, fileData);
              }

              treeDirObject.children.push(treeFileObject);
            });

            previousTreeDirObject.children.push(treeDirObject);

            if (Object.keys(currentDir).length == 1) {
              currentDir = null;
              break;
            } else {
              for (let obj in currentDir) {
                if (obj != "files" && obj != "name" && obj != "_files") {
                  previousTreeDirObject = treeDirObject;
                  currentDir = currentDir[obj];
                  path += "/" + obj;
                  currentName = obj;
                }
              }
            }

          }
        }

      }
      structure.push(treeDirectoryObject);
    });

    this.fileData = structure;
    this.reloadTree(structure);
    this.setSaveFileEventListener();

    const root = structure[0].name;
    const file = structure[0].children[0].name;

    this.getSingleFile(root, file);
    localStorage.setItem('currentFileRoot', root);
    localStorage.setItem('currentFile', file);

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

      //Todo: use jquery instead of getting nodeValue
      let path = e.delegateTarget.attributes[3].nodeValue,
        deployableUnit = e.delegateTarget.attributes[1].nodeValue;
  
      if(path == null || deployableUnit == null) {
        return;
      }
      console.log(path, deployableUnit);

      deployableUnit = cur.replaceEncodings(deployableUnit);

      localStorage.setItem('currentFile', path);
      localStorage.setItem('currentFileRoot', deployableUnit);

      let root = deployableUnit.match(/^[^]*?(?=\/)/g)

      if (root == null) {
        cur.getSingleFile(deployableUnit, path);
      } else {
        path = deployableUnit.replace(root, '') + '/' + path;
        cur.getSingleFile(root[0], path);
      }

    });

    $('.folder').on('click', function (e) {
      const folderElement = $(e.currentTarget);
      let text = $(e.currentTarget.firstElementChild).text();

      if (folderElement.hasClass("mjs-nestedSortable-expanded")) {
        text = text.replace(/> /g, '\u2304 ');
      } else {
        text = text.replace(/\u2304 /g, '> ');
      }
      $(e.currentTarget.firstElementChild).text(text);

      localStorage.setItem('currentFileRoot', text);
    })

  }

  saveFile() {
    const currentFile = localStorage.getItem('currentFile');

    let currentFileRoot = localStorage.getItem('currentFileRoot');
        currentFileRoot = this.replaceEncodings(currentFileRoot);

    if (currentFile != null && currentFileRoot != null) {
      this.fileService.addFile(currentFileRoot, currentFile, this.editor.getValue());
    }
  }

  //TODO: add all adapters of current config to adapter select.
  generateAdapters() {
    let currentConfig = localStorage.getItem("currentFile");
        currentConfig = localStorage.getItem(currentConfig)

    let adapters = currentConfig.match(/<Adapter[^]*?>[^]*?<\/Adapter>/g);

    this.optionView.addOptions(adapters);
  }


  addFile(folder) {

    const name = prompt("File name: ");
    const displayName = name.replace(/\.[^]*/g, '');

    if (name == "") {
      alert('Can\'t make empty file');
      return;
    }



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
      id: folder,
      name: name,
      type: 'file'
    };

    this.fileData.forEach((dir, index) => {
      if (dir.name == folder) {
        dir.children.push(obj);
      }
    });

    const data = this.fileData;
    let root = localStorage.getItem('currentFileRoot');

    root = this.replaceEncodings(root);
    folder = this.replaceEncodings(folder);

    if (folder != root) {
      name = folder + '/' + name;
    }

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

    //$('.folder ol').addClass('folderStyle');
  }


  renameFile(deployableUnit, oldName, newName) {
    this.fileService.renameFile(deployableUnit, oldName, newName);

    this.fileService.getConfigurations();
  }

  deleteFile(root, path) {

    this.fileData.forEach((dir, index) => {

      if (root == dir.name) {
        dir.children = dir.children.filter((file) => {
          return file.name != path;
        })

      }
    })

    root = this.replaceEncodings(root);

    this.fileService.deleteFile(root, path);
    localStorage.setItem('currentFile', "");
    localStorage.setItem('currentFileRoot', "");


    this.reloadTree(this.fileData);
    this.setSaveFileEventListener();

  }

  addFolder(root, path) {
    this.fileService.addFolder(root, path);
  }
}
