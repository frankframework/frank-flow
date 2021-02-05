import ToBeautifulSyntax from '../View/codeView/ToBeautifulSyntax.js';


export default class FileService {
    constructor(codeController) {
        this.codeController = codeController;

        this.toBeautifulSyntax = new ToBeautifulSyntax();

    }



    async getConfigurations() {
        const cur = this,
            path = './api/configurations';

        fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.json();
        }).then(data => {

            const fileTree = [];

            data.forEach(async function (item, index) {
                let obj = await cur.getDeployableUnit(item);
                fileTree.push(obj);

                if (fileTree.length === data.length) {
                    cur.codeController.fileTreeView.makeTree(fileTree);
                    return fileTree;
                }
            })


        }).catch(e => {
            alert('Please check if your ibis started up correctly or if the property "configurations.directory" is set correctly')
            console.error('Error getting configurations: ', e);
        })
    }

    getDeployableUnit(name) {
        const path = './api/configurations/' + name;


        return fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.json();
        }).then(fileList => {
            let directoryObject = {
                name: name,
                files: [...fileList._files]
            };
            //sconsole.log(directoryObject)
            for (let key in fileList) {
                if (key != "_files") {
                    directoryObject[key] = fileList[key];
                }
            }
            return directoryObject;
        }).catch(e => {
            console.error('Error getting deployable unit: ' + name, e);
        })
    }

    getSingleFile(deployableUnit, name) {
        //http://localhost/frank-flow/api/configurations/Example/files/?path=InnerExampleFolder/ConfigurationProcessDestination.xml
        const cur = this,
            path = './api/configurations/' + deployableUnit + '/files/?path=' + name;

        fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.text();
        }).then(data => {

            let beautiful = this.toBeautifulSyntax.toBeautifulSyntax(data);
            data = beautiful;

            let adapterName = data.match(/<Adapter[^]*?name=".*?"/g);

            if(adapterName == null) {
                return;
            }

            adapterName = adapterName[0].match(/".*?"/g)[0].replace(/"/g, '');

            cur.codeController.setEditorValue(beautiful);
            localStorage.setItem('currentAdapter', adapterName);
            cur.codeController.quickGenerate();
        }).catch(e => {
            console.error('Error getting file: ', e);
        })
    }

    deleteFile(deployableUnit, name) {
        const path = './api/configurations/' + deployableUnit + '/files/?path=' + name;

        fetch(path, {
            method: 'DELETE'
        }).then(response => {
            return response.text();
        }).catch(e => {
            console.error('Error deleting file: ' + name, e);
        })
    }

    addFile(deployableUnit, name, config) {
        const path = './api/configurations/' + deployableUnit + '/files/?path=' + name,
            formData = new FormData();

        formData.append('file', config);

        fetch(path, {
            method: 'POST',
            body: formData
        }).then(response => {
            return response.text();
        }).catch(e => {
            console.error('Error adding file: ' + name, e);
        })
    }

    addFolder(deployableUnit, name) {
        const path = './api/configurations/' + deployableUnit + '/files/?path=' + name,
            formData = new FormData();

        //formData.append('file', config);

        fetch(path, {
            method: 'POST',
            body: formData
        }).then(response => {
            return response.text();
        }).catch(e => {
            console.log('Error adding file: ' + name, e);
        })
    }

    renameFile(deployableUnit, name, newName) {
        const path = './api/configurations/' + deployableUnit + '/files/?path=' + name,
            cur = this;


        fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.text()
        }).then(text => {
            cur.deleteFile(deployableUnit, name);
            cur.addFile(deployableUnit, newName, text);
            return;
        })
    }
}
