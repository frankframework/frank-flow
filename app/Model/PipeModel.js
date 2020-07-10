export default class PipeModel {
    constructor(name, possitions, extra, isExit, descText) {
        this.attributes = {};
        this.parameters = {};
        this.name = name;
        this.possitions = possitions;
        this.extra = extra;
        this.isExit = isExit;
        this.descText = descText
        this.type = "";
    }
}