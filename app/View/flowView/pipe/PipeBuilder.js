import PipeView from './PipeView.js';
import ActivityPipeView from './ActivityPipeView.js';

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

    isExit(exit) {
        this.exit = exit;
        return this;
    }

    withDescText(descText) {
        this.descText = descText;
        return this;
    }

    build() {
        if (!('isExit' in this)) {
            throw new Error('isExit was not defined');
        } else if (!('positions' in this)) {
            this.positions = null;
        } else if (!('extra' in this)) {
            this.extra = null;
        } else if (!('descText' in this)) {
            this.descText = null;
        } else if (!('exit' in this)) {
            this.isExit = false;
        }

        if (this.name != null && this.flowView != null) {
            if (localStorage.getItem("tibcoMode") == "true") {
                return new ActivityPipeView(this.flowView, this.name, this.positions, this.extra, this.exit, this.descText);
            } else {
                return new PipeView(this.flowView, this.name, this.positions, this.extra, this.exit, this.descText);
            }
        }
    }
}