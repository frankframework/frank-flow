import ToBeautifulSyntax from '../View/codeView/ToBeautifulSyntax.js';
import JSZip from 'jszip/dist/jszip';


export default class FileService {
    constructor(codeController) {
        this.codeController = codeController;

        this.deployableUnit = null;
    }



    async getConfigurations() {
        let cur = this,
            path = './api/configurations';

        fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.json();
        }).then(data => {

            let fileTree = [];

            data.forEach(async function (item, index) {
                let obj = await cur.getDeployableUnit(item);
                console.log("object: ", obj);
                fileTree.push(obj);

                if (fileTree.length == data.length) {
                    cur.codeController.fileTreeView.makeTree(fileTree);
                    return fileTree;
                }
            })


        }).catch(e => {
            alert('Please check if your ibis started up correctly or if the property Configurations.directory is set correctly')
            console.log('error getting configs: ' + e);
        })
    }

    getDeployableUnit(name) {
        let cur = this,
            path = './api/configurations/' + name;

        this.deployableUnit = name;
        return fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.json();
        }).then(fileList => {
            let directoryObject = {
                name: name,
                files: [...fileList._files]
            };
            return directoryObject;
        }).catch(e => {
            console.log('error getting configs: ' + e);
        })
    }

    getSingleFile(name) {
        let cur = this,
            path = './api/configurations/' + this.deployableUnit + '/files/?path=' + name;

        fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.text();
        }).then(data => {
            cur.codeController.setEditorValue(data);

            let adapterName = data.match(/<Adapter[^]*?name=".*?"/g);
            adapterName = adapterName[0].match(/".*?"/g)[0].replace(/"/g, '');

            localStorage.setItem('currentAdapter', adapterName);

            cur.codeController.quickGenerate();
        }).catch(e => {
            console.log('error getting configs: ' + e);
        })
    }

    // loadZip(configurationName) {
    //     configurationName = configurationName.match(/".*?"/g)[0].replace(/"/g, '');
    //     console.log(configurationName)
    //     const versionPath = '../iaf/api/configurations/' + configurationName + '/versions';
    //     const options = {
    //         headers: {
    //             'Content-disposition': 'attachment; filename="filename.jpg"'
    //         },
    //         method: 'GET'
    //     }
    //     fetch(versionPath, options)
    //         .then(response => {
    //             return response.json();
    //         })
    //         .then(data => {
    //             if (data) {
    //                 let version = prompt('please enter a version number');
    //                 let ver = data[0].version;

    //                 data.forEach(function (item, i) {
    //                     if (item.version.match(version + '(?=_)')) {
    //                         ver = item.version;
    //                     }
    //                 })
    //                 let zipPath = '../iaf/api/configurations/' + configurationName + '/versions/' + ver + '/download';
    //                 fetch(zipPath, { method: 'GET' }).then(response => {
    //                     return response.blob();
    //                 })
    //                     .then(zipFile => {
    //                         this.mainController.codeController.fileTreeView.makeTree(zipFile);
    //                     })
    //             }
    //         })
    // }
}