import PipeView from './PipeView.js';

export default class PipeBuilder {
    constructor(flowView, name) {
        this.flowView = flowView;
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
        if(!('isExit' in this)) {
            throw new Error('isExit was not defined');
        }

        return new PipeView()
    }
}