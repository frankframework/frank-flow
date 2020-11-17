export default class XsdService {
    constructor(xsdModel) {
        this.xsdModel = xsdModel;
    }

    getXsd() {
        fetch('./media/ibisdoc.xsd', {
            method: 'GET'
        })
            .then(response => {
                return response.text()
            })
            .then(data => {
                this.xsdModel.setXsd(data);
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
                this.xsdModel.setXsd(data);
            })
            .catch(err => {
                console.log("not loaded xsd", err);
            })
    }
}