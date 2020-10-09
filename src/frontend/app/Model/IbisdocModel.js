export default class IbisdocModel {

  constructor() {
    this.ibisdoc = {};
    this.listeners = [];
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(data) {
    this.listeners.forEach(l => l.notify(data));
  }

  setIbisdoc(data) {
    this.ibisdoc = data;
    this.notifyListeners(data);
  }

  getIbisdoc() {
    return this.ibisdoc;
  }
}
