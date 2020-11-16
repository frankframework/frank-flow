export default class FileModel {

    constructor() {
      this._fileStructure = {};
      this.listeners = [];
    }
  
    addListener(listener) {
      this.listeners.push(listener);
    }
  
    notifyListeners(data) {
      this.listeners.forEach(l => l.notify(data));
    }
  
    setFileStructure(fileStructure) {
      this._fileStructure = fileStructure;
      this.notifyListeners(this._fileStructure);
    }
  
    getFileStructure() {
      return this._fileStructure;
    }
  }