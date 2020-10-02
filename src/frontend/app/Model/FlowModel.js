export default class FlowModel {

  constructor() {
    this.forwards = [];
    this.transformedXml =  {};
    this.receivers = [];
  }

  getForwards() {
    return this.forwards;
  }

  setForwards(forwards) {
    this.forwards = forwards;
  }

  getTransformedXml() {
    return this.transformedXml;
  }

  setTransformedXml(xml) {
    this.transformedXml = xml;
  }

  getReceivers() {
    return this.receivers;
  }

  setReceivers(receivers) {
    this.receivers = receivers;
  }

}
