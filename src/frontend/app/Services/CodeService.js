import ToBeautifulSyntax from '../View/codeView/ToBeautifulSyntax.js';
import JSZip from '../../node_modules/jszip/dist/jszip.js';


export default class CodeService {
    constructor(codeView, ibisdocModel, xsdModel, mainController) {
        this.ibisdocModel = ibisdocModel;
        this.xsdModel = xsdModel;
        this.codeView = codeView;
        this.mainController = mainController;
        this.toBeautiful = new ToBeautifulSyntax();

        this.deployableUnit = null;

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
                return response.json()
            })
            .then(data => {
                cur.codeView.ibisdocJson = data;
                cur.ibisdocModel.setIbisdoc(data);
            })
            .catch(err => {
              console.warn('Couldn\'t load pipe palette from local ibisdoc: ' + err);
              this.getDefaultIbisdoc();
            })

    }

    getDefaultIbisdoc() {
        let cur = this;
        fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.json', {
            method: 'GET'
        })
            .then(response => {
                return response.json()
            })
            .then(data => {
                cur.codeView.ibisdocJson = data;
                cur.ibisdocModel.setIbisdoc(data);
            })
            .catch(err => {
                alert("Couldn't load pipe palette");
                console.error('Couldn\'t load pipe palette from ibis4example: ' + err);
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
            })
            .catch(err => {
                console.warning("Couldn't load local XSD, now loading ibis4example XSD: ", err);
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
            })
            .catch(err => {
                console.error("Error loading ibis4example XSD: ", err);
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
            cur.getDeployableUnit(data[0]);
        }).catch(e => {
            alert('Please check if your ibis started up correctly or if the property "configurations.directory" is set correctly')
            console.error('Error getting configurations: ' + e);
        })
    }

    getDeployableUnit(name) {
        let cur = this,
            path = './api/configurations/' + name;

        this.deployableUnit = name;
        fetch(path, {
            method: 'GET'
        }).then(response => {
            return response.json();
        }).then(data => {
            cur.mainController.codeController.fileTreeView.makeTree(data._files);
        }).catch(e => {
            console.error('Error getting configurations: ' + e);
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
        cur.mainController.codeController.setEditorValue(data);
        cur.mainController.generateFlow();
    }).catch(e => {
        console.error('Error getting configurations: ' + e);
    })
    }
}
