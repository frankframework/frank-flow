export default class XsdModel {
    constructor() {
        this.xsd = "";
        this.listeners = [];
    }

    addListener(listener) {
        this.listeners.push(listener);
    }

    notifyListeners(data) {
        this.listeners.forEach(l => l.notify(data));
    }

    addXsd(path, data) {
        let xsdData = {
            path: path,
            fileData: data
        };
        this.notifyListeners(xsdData);
    }

    getXsd() {
        return this.xsd;
    }
}