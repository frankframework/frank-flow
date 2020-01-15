import JSZip from '../../../node_modules/jszip/dist/jszip.js';

export default class FileTreeView {
  constructor(editor) {
    this.editor = editor;
  }

  makeTree(input) {
    localStorage.removeItem('changedFiles');
    localStorage.removeItem('currentFile');
    $('#fileTreeItems').empty();
    let cur = this;
    var f,
      fileTree = [];
    //loop through all files
    for (var i = 0; i < input.files.length; i++) {
      f = input.files[i];
      //load file in async
      JSZip.loadAsync(f) // 1) read the Blob
        .then(function(zip) {
          //loop through file, if file is not a folder then put the data in local storage.
          zip.folder(f.name.replace('.zip', ''), '');
          zip.forEach(function(relativePath, zipEntry) { // 2) print entries
            fileTree.push(zipEntry);
            if (!zipEntry.dir) {
              zip.file(zipEntry.name).async("string").then(function(data) {
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

          //save zip file in this class.
          cur.zip = zip;

          cur.generateTree(fileTree);
          localStorage.setItem("changedFiles", JSON.stringify([]))

          //when click event on file, save the current file.
          cur.setSaveFileEventListener();
        }, function(e) {
          console.log("error", e);
        });
    }
  }

  setSaveFileEventListener() {
    let cur = this;
    $('.file').on("click", function(e) {
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
    });
  }

  generateTree(fileTree) {
    let data = [],
    path,
    cur = this;
    //make for each file entry a JSON object with info about the file.
    fileTree.forEach(function(item, index) {
      let obj = {
        id: 'dir' + index,
        name: item.name,
        type: (item.dir ? 'dir' : 'file')
      }
      path = item.name.match(/[^]*?\//g);
        if(index == 0) {
          cur.root = obj;
        }

      data.push(obj);
      //decode the content of the file and put it in local storage.
      var string = String.fromCharCode.apply(null, fileTree[1]._data.compressedContent);
      localStorage.setItem(item.name, string);
    });

    data = this.mapFileTree(data, path);

    //generate the tree.
    $('#fileTreeItems').fileTree({
      data: data,
      sortable: false,
      selectable: true
    });

    //after generating the tree, display the tree.
    $('#fileTree').css('display', 'flex');
  }


  //algorithm to put each file inside of the corresponding map.
  mapFileTree(data, path) {
    console.log("data before mapping algorithm", data, path);
    let curDir,
    cur = this;
    path.forEach(function (p, index) {
      data = [cur.root].concat(data.slice(1));
      data.forEach(function (dat, ind) {
        let name = dat.name.match(/[^]*?\//g);
        name = name[name.length - 1];
        console.log(p, dat, name);
        if(p == name) {

          if(dat.type == "dir") {
            dat.children = [];
            curDir = dat;
          } else {
            curDir.children.push(dat);
            data[ind] = null;
          }
          console.log("cur dir is: ", curDir);
        }
      });
    });

    data = data.filter(function(el) {return el != null});
    console.log("data after mapping algorithm", data);
    return data;
  }
}
