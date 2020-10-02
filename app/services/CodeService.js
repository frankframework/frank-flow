import ToBeautifulSyntax from '../View/codeView/ToBeautifulSyntax.js';
import JSZip from '../../node_modules/jszip/dist/jszip.js';


export default class CodeService {
    constructor(codeView, ibisdocModel, xsdModel, mainController) {
        this.ibisdocModel = ibisdocModel;
        this.xsdModel = xsdModel;
        this.codeView = codeView;
        this.mainController = mainController;
        this.toBeautiful = new ToBeautifulSyntax();

        this.getXsd();
        this.getIbisdoc();
        this.getConfigurations();
    }

    getIbisdoc() {
        let cur = this;
        fetch('../rest/ibisdoc/ibisdoc.json', {
            method: 'GET'
        })
            .then(response => {
                console.log("get the docs!")
                return response.json()
            })
            .then(data => {
                cur.codeView.ibisdocJson = data;
                cur.ibisdocModel.setIbisdoc(data);
                cur.mainController.setPipes(data);
            })
            .catch(err => {
                console.log("couldn't load ibisdoc, now switching to default ibisdoc", err);
                this.getDefaultIbisdoc();
            })

    }

    getDefaultIbisdoc() {
        let cur = this;
        fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.json', {
            method: 'GET'
        })
            .then(response => {
                console.log(response)
                return response.json()
            })
            .then(data => {
                console.log(data)
                cur.codeView.ibisdocJson = data;
                cur.ibisdocModel.setIbisdoc(data);
                cur.mainController.setPipes(data);
            })
            .catch(err => {
                alert("couldn't load pipe palette");
                console.log(err);

            })
    }

    getXsd() {
        fetch('../rest/ibisdoc/ibisdoc.xsd', {
            method: 'GET'
        })
            .then(response => {
                return response.text()
            })
            .then(data => {
                this.xsdModel.setXsd(data);
                console.log("xsd is loaded!, here");
            })
            .catch(err => {
                console.log("couldn't load xsd, now loading deafult xsd", err);
                this.getDefaultXsd();
            })
    }

    getDefaultXsd() {
        fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.xsd', {
            method: 'GET'
        })
            .then(response => {
                return response.text()
            })
            .then(data => {
                this.xsdModel.xsd = data;
                console.log("xsd is loaded!, here");
            })
            .catch(err => {
                console.log("not loaded xsd", err);
            })
    }

    getConfigurations() {
        let cur = this,
            path = './api/configurations';

        fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.json();
        }).then(data => {
            console.log(data[0]);
            cur.getDeployableUnit(data[0]);
        }).catch(e => {
            console.log('error getting configs: ' + e);
        })
    }

    getDeployableUnit(name) {
        let cur = this,
            path = './api/configurations/' + name;

        fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.json();
        }).then(data => {
            console.log(data);
            cur.mainController.codeController.fileTreeView.makeTree(zipFile);
        }).catch(e => {
            console.log('error getting configs: ' + e);
        })
    }

    loadZip(configurationName) {
        configurationName = configurationName.match(/".*?"/g)[0].replace(/"/g, '');
        console.log(configurationName)
        const versionPath = '../iaf/api/configurations/' + configurationName + '/versions';
        const options = {
            headers: {
                'Content-disposition': 'attachment; filename="filename.jpg"'
            },
            method: 'GET'
        }
        fetch(versionPath, options)
            .then(response => {
                return response.json();
            })
            .then(data => {
                if (data) {
                    let version = prompt('please enter a version number');
                    let ver = data[0].version;

                    data.forEach(function (item, i) {
                        if (item.version.match(version + '(?=_)')) {
                            ver = item.version;
                        }
                    })
                    let zipPath = '../iaf/api/configurations/' + configurationName + '/versions/' + ver + '/download';
                    fetch(zipPath, { method: 'GET' }).then(response => {
                        return response.blob();
                    })
                        .then(zipFile => {
                            this.mainController.codeController.fileTreeView.makeTree(zipFile);
                        })
                }
            })
    }
}