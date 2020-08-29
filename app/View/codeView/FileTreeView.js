import JSZip from '../../../node_modules/jszip/dist/jszip.js';
import OptionView from './codeEditViews/OptionView.js';

export default class FileTreeView {
  constructor(editor) {
    this.editor = editor;
    this.fileData = null;
    this.addedFileCounter = 0;
    this.optionView = new OptionView(this.editor);
  }

  makeTree(input) {
    localStorage.removeItem('changedFiles');
    localStorage.removeItem('currentFile');
    $('#fileTreeItems').empty();
    let cur = this;
    var f,
      fileTree = [];
    f = input;
    //load file in async
    JSZip.loadAsync(f) // 1) read the Blob
      .then(function (zip) {
        cur.prepareFileTree(zip, fileTree);

        cur.zip = zip;

        cur.generateTree(fileTree);
        localStorage.setItem("changedFiles", JSON.stringify([]))

        cur.setSaveFileEventListener();
      }, function (e) {
        console.log("error", e);
      });
  }

  prepareFileTree(zip, fileTree) {
    //loop through file, if file is not a folder then put the data in local storage.
    zip.forEach(function (relativePath, zipEntry) { // 2) print entries
      fileTree.push(zipEntry);
      if (!zipEntry.dir) {
        zip.file(zipEntry.name).async("string").then(function (data) {
          localStorage.setItem(zipEntry.name, data);
        });
      }
    });

    /*
    switch the last element in the fileTree with the first element.
    TODO: make a more efficient method that inserts the last element
    at possition 0 and shift the entire array.
    */
    let temp = fileTree[0];
    fileTree[0] = fileTree[fileTree.length - 1];
    fileTree[fileTree.length - 1] = temp;
  }

  setSaveFileEventListener() {
    let cur = this;
    $('.file').on("click", function (e) {
      let currentFile = localStorage.getItem("currentFile"),
        path = e.delegateTarget.attributes[3].nodeValue;
      if (currentFile != null) {
        let arr = JSON.parse(localStorage.getItem("changedFiles"));
        arr.push(currentFile);
        localStorage.setItem("changedFiles", JSON.stringify(arr));

        localStorage.setItem(currentFile, cur.editor.getModel().getValue());
        cur.zip.file(currentFile, cur.editor.getModel().getValue());
      }
      localStorage.setItem("currentFile", path)
      cur.editor.setValue(localStorage.getItem(path))
      cur.generateAdapters();
    });
  }

  generateAdapters() {
    let currentConfig = localStorage.getItem("currentFile");
    currentConfig = localStorage.getItem(currentConfig)

    let adapters = currentConfig.match(/<Adapter[^]*?>[^]*?<\/Adapter>/g);

    this.optionView.addOptions(adapters);
  }

  //create file objects, sort them with the map method and then generate file tree
  generateTree(fileTree) {
    let data = [],
      path = [],
      cur = this;
    //make for each file entry a JSON object with info about the file.
    fileTree.forEach(function (item, index) {
      let obj = {
        id: 'dir' + index,
        name: item.name,
        type: (item.dir ? 'dir' : 'file')
      }
      let newPath = item.name.match(/[^]*?\//g);
      if (newPath.length > path.length) {
        path = newPath;
      }
      if (index == 0) {
        cur.root = obj;
      }

      data.push(obj);
      //decode the content of the file and put it in local storage.
      var string = String.fromCharCode.apply(null, fileTree[1]._data.compressedContent);
      localStorage.setItem(item.name, string);
    });

    data = this.mapFileTree(data, path);
    this.fileData = data;

    //generate the tree.
    $('#fileTreeItems').fileTree({
      data: data,
      sortable: false,
      selectable: true
    });

    //after generating the tree, display the tree.
    $('#fileTree').css('display', 'flex');

    //make the file tree resizable.
    this.makeFileTreeResizeable()
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
      console.log("rename", index, currentFile, arr);
      if (index > -1) {
        arr.splice(index, 1);
      }
      localStorage.setItem("changedFiles", JSON.stringify(arr));
    }
    localStorage.setItem("currentFile", newPath);

    const fileData = localStorage.getItem(path);
    let prependedPath = path.match(/[^]+\/+/g)[0];
    console.log(prependedPath, newPath)
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
      console.log('delete', index, path)
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

  makeFileTreeResizeable() {
    let cur = this;
    $('#fileTree').mousedown(function (e) {
      if (parseInt($(this).css('width')) - 10 <= e.offsetX) {
        cur.resize = true;
      }
    });

    $('#fileTree').mouseup(function (e) {
      cur.resize = false;
    })

    $('#fileTree').mousemove(function (e) {
      if (parseInt($(this).css('width')) - 10 <= e.offsetX) {
        $('#fileTree').css('cursor', 'e-resize');
      } else {
        $('#fileTree').css('cursor', 'auto');
      }

      if (cur.resize) {
        $(this).css('width', e.offsetX);
      }
    });
  }


  //algorithm to put each file inside of the corresponding map.
  mapFileTree(data, path) {
    let curDir,
      mainDir,
      directoryArray = [],
      cur = this,
      fileTree = [];

    //first concat the root file to the beginning of the array.
    data = [cur.root].concat(data.slice(1));

    //first make the objects for the directory's
    path.forEach(function (p, index) {
      let obj = {
        id: 'dir' + index,
        name: p,
        type: 'dir',
        children: []
      }
      //array to refference each directory.
      directoryArray.push(obj);

      //put all of the directory's inside of each other.
      if (curDir != null) {
        curDir.children.push(obj);
        curDir = obj;
      } else {
        curDir = obj;
        mainDir = curDir;
      }
    });

    //add the root to the fileTree array.
    fileTree.push(mainDir);

    //filter all of the directory's out of the data array.
    data = data.filter(function (el) {
      return el.type != 'dir'
    });

    //loop over the data array and match directory name.
    data.forEach(function (item, index) {
      let name = item.name.match(/[^]*?\//g);
      name = name[name.length - 1];
      directoryArray.forEach(function (dir, ind) {
        if (dir.name == name) {
          dir.children.push(item);
        }
      });
    });
    return fileTree;
  }
}
