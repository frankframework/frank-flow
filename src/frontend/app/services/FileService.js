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
                fileTree.push(obj);

                if (fileTree.length == data.length) {
                    cur.codeController.fileTreeView.makeTree(fileTree);
                    return fileTree;
                }
            })


        }).catch(e => {
            alert('Please check if your ibis started up correctly or if the property Configurations.directory is set correctly')
            console.log('error getting configs: ', e);
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
            console.log('error getting configs: ', e);
        })
    }

    getSingleFile(deployableUnit, name) {
        let cur = this,
            path = './api/configurations/' + deployableUnit + '/files/?path=' + name;

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
            console.log('error getting configs: ', e);
        })
    }

    deleteFile(deployableUnit, name) {
        let cur = this,
            path = './api/configurations/' + deployableUnit + '/files/?path=' + name;

        fetch(path, {
            method: 'DELETE'
        }).then(response => {
            return response.text();
        }).then(data => {
            console.log(data);
        }).catch(e => {
            console.log('error getting configs: ', e);
        })
    }

    addFile(deployableUnit, name, config) {

        let formData = new FormData();

        formData.append('file', config);

        let cur = this,
            path = './api/configurations/' + deployableUnit + '/files/?path=' + name;

        fetch(path, {
            method: 'POST',
            body: formData
        }).then(response => {
            return response.text();
        }).then(data => {
            console.log(data);
        }).catch(e => {
            console.log('error getting configs: ', e);
        })
    }
}