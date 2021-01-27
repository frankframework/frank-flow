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

    console.log(input);

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

        treeDirectoryObject.children.push(treeFileObject);
      });


      //Make objects for inner directories of deployable unit.
      for (let key in dir) {

        //If the key is not 'files' or 'name' then it is a inner folder.
        if (key != "files" && key != "name") {

          //Save path and parent dir.
          let path = "";
          let parentDir = dir;

          //At the end of while loop make the inner directory the new parentDir
          while (parentDir) {

            //Make object for dir
            let treeDirObject = {
              id: directoryName + "/" + key,
              name: '> ' + key,
              type: 'dir',
              children: []
            }

            //Fill dir object with files.
            dir[key]._files.forEach(function (file, index) {
              let treeFileObject = {
                id: directoryName + "/" + key,
                name: file,
                type: 'file'
              }

              treeDirObject.children.push(treeFileObject);
            });

            //Set here the new parent dir
            for (let key in parentDir) {
              if (key != "files" && key != "name") {
                parentDir = parentDir[key];
              }
            }
          }

          treeDirectoryObject.children.push(treeDirObject);
        }


      }
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
    console.log("Root: ", root);
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
        deployableUnit = e.delegateTarget.attributes[1].nodeValue,
        parent = e.delegateTarget.offsetParent.attributes[1].nodeValue;


      deployableUnit = cur.replaceEncodings(deployableUnit);
      parent = cur.replaceEncodings(parent);

      console.log("Parent: ", parent, "Path: ", path, "deployable unit: ", deployableUnit);

      // if(parent != deployableUnit) {
      //   path = parent + '/' + path;
      // }


      localStorage.setItem('currentFile', path);
      localStorage.setItem('currentFileRoot', deployableUnit);

      let root = deployableUnit.match(/^[^]*?(?=\/)/g)

      if (root == null) {
        cur.getSingleFile(deployableUnit, path);
      } else {
        path = deployableUnit.replace(root, '') + '/' + path;
        cur.getSingleFile(root[0], path);
      }

      console.log("\n\n\n Final root: ", root, "Final path: ", path);


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
      //console.log(text, e);
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
    const currentConfig = localStorage.getItem("currentFile");
    currentConfig = localStorage.getItem(currentConfig)

    let adapters = currentConfig.match(/<Adapter[^]*?>[^]*?<\/Adapter>/g);

    this.optionView.addOptions(adapters);
  }


  addFile(folder) {
    const name = prompt("File name: ");

    if (name == "") {
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


    const root = localStorage.getItem('currentFileRoot');

    root = this.replaceEncodings(root);
    folder = this.replaceEncodings(folder);


    console.log("ADDING: ", folder, name, root);

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
    // localStorage.setItem(prependedPath + newPath, fileData);s

    // let fileTree = []
    // this.prepareFileTree(this.zip, fileTree);
    // $('#fileTreeItems').empty();
    // this.generateTree(fileTree);
    // this.setSaveFileEventListener();

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
