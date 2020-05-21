import {PipeView} from './PipeView.js';

export default class PipeBuilder {
    constructor(name) {
        this.name = name;
    }

    withPositions(positions) {
        this.positions = positions;
        return this;
    }

    withExtra(extra) {
        this.extra = extra;
        return this;
    }

    isExit(isExit) {
        this.isExit = isExit;
        return this;
    }

    withDescText(descText) {
        this.descText = descText;
        return this;
    }

    build() {

    }
}