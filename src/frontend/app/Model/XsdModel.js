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
        console.log("Added XSD ", path, data);
        this.notifyListeners(path, data);
    }

    setXsd(data) {
        this.xsd = data;
        this.notifyListeners(data);
    }

    getXsd() {
        return this.xsd;
    }
}