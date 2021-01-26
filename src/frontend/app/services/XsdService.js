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
                this.xsdModel.setXsd(data);
            })
            .catch(err => {
                console.error("Error loading ibis4example XSD: ", err);
            })
    }
}
