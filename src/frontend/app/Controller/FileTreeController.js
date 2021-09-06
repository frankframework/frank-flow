import FileTreeView from '../View/codeView/FileTreeView.js';
import FileService from '../services/FileService.js';

export default class FileTreeController {
    constructor(editor, xsdModel) {

        this.editor = editor;
        this.xsdModel = xsdModel;

        this.fileService = new FileService(this);
        this.fileService.getConfigurations();

        this.fileTreeView = new FileTreeView(this.editor, this.fileService, this.xsdModel);

        this.initEventListeners();
    }

    setEditorValue(value) {
        this.editor.setValue(value);
    }

    initEventListeners() {
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
                    callback: function () {
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

                        if (newName == "" || newName == null) {
                            return;
                        }

                        let root = cur.fileTreeView.replaceEncodings($(this).attr('data-id'));
                        let innerRoot = root.match(/^[^]*?(?=\/)/g)

                        if (innerRoot == null) {
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


        $('#saveFile').on('click', function (e) {
            cur.fileTreeView.saveFile();
        })
        
        $('#addFile').click(function () {
            const currentFileRoot = '> ' + localStorage.getItem('currentFileRoot');
            cur.fileTreeView.addFile(currentFileRoot);
        })
    }
}