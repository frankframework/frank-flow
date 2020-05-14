import PipeView from '../PipeView.js';
import ForwardGenerator from './ForwardGenerator.js';
import CustomElementGenerator from './CustomElementGenerator.js';

export default class PipeGenerator {

    constructor(flowModel, flowView) {
        this.flowModel = flowModel;
        this.flowView = flowView;
        this.pipeView = new PipeView(flowView);
        this.forwardGenerator = new ForwardGenerator(flowModel, flowView);
        this.customElementGenerator = new CustomElementGenerator(this);
    }

    addPipe(name = "pipe" + (this.flowView.windows), possitions, extra = "", isExit, descText) {
        return this.pipeView.addPipe(name, possitions, extra, isExit, descText);
    }

    generateAllPipes(transformedXml) {
        if (transformedXml.Adapter.Pipeline.pipe != null) {
            $('#canvas').text("Adapter: " + transformedXml.Adapter['@name'] + ' ');
            let pipe = transformedXml.Adapter.Pipeline.pipe;
            let forwards = [];
            let possitions = null;

            if (Array.isArray(pipe)) {
                possitions = this.generateMultiplePipes(pipe, forwards, possitions);
            } else {
                this.generateSinglePipe(pipe, forwards);
            }
            this.customElementGenerator.addExits(transformedXml.Adapter.Pipeline.Exit);

            if (possitions == "duplicate") {
                this.flowView.displayError("dupplicate");
                return;
            }
            else if (possitions == null) {
                this.flowView.setOffsets(false);
            } else {
                this.flowView.setOffsets(true);
            }

            if (transformedXml.Adapter.Receiver != null) {
                let forwardData = this.customElementGenerator.addReceiver(transformedXml, forwards[0].sourcePipe);
                forwards.push(forwardData);
            }

            this.forwardGenerator.generateForwards(forwards);
        }
    }

    generateMultiplePipes(pipe, forwards, possitions) {
        let cur = this,
            error = false;
        let sortedPipe = pipe.slice().sort();
        sortedPipe.forEach((currentPipe, index) => {
            if (sortedPipe[index + 1] != null) {
                if (sortedPipe[index + 1]['@name'] === currentPipe['@name']) {
                    console.log('duplicate: ', currentPipe);
                    error = true;
                }
            }
        })

        if (error) {
            return "duplicate";
        }

        for (let p in pipe) {
            let name = pipe[p]['@name'],
                xpos = pipe[p]['@x'],
                ypos = pipe[p]['@y'],
                extraText = "",
                docText = null;

            possitions = this.checkPossitions(xpos, ypos);

            extraText = this.createExtraText(pipe, p);
            docText = this.createDocText(pipe, p);

            this.addPipe(name, possitions, extraText, null, docText);

            if (pipe[p].Forward != null) {
                forwards = this.createPipeForward(pipe, name, p, forwards);
            } else {
                forwards = this.createDefaultForward(pipe, name, p, forwards);
            }
        }
        return possitions;
    }

    createDefaultForward(pipe, name, p, forwards) {
        let nextPipe = parseInt(p) + 1;
        if (pipe[nextPipe] != null) {
            let forwardData = {
                sourcePipe: name,
                targetPipe: pipe[nextPipe]['@name'],
                name: "success"
            }
            forwards.push(forwardData);
        }

        return forwards;
    }

    createPipeForward(pipe, name, p, forwards) {
        let forwardData = null;

        if (Array.isArray(pipe[p].Forward)) {
            pipe[p].Forward.forEach(function (item, index) {
                forwardData = {
                    sourcePipe: name,
                    targetPipe: item['@path'],
                    name: item['@name']
                };
                forwards.push(forwardData);
            });
        } else {
            forwardData = {
                sourcePipe: name,
                targetPipe: pipe[p].Forward['@path'],
                name: pipe[p].Forward['@name']
            };
            forwards.push(forwardData);
        }

        return forwards;
    }

    createExtraText(pipe, p) {
        let extraText = "";
        if (pipe[p]['@xpathExpression'] != null) {
            extraText = pipe[p]['@xpathExpression'].slice(0, 15) + '...';
        } else if (pipe[p].FixedQuerySender != null && pipe[p].FixedQuerySender['@query'] != null) {
            extraText = pipe[p].FixedQuerySender['@query'].slice(0, 15) + '...';
        }

        return extraText;
    }

    createDocText(pipe, p) {
        let docText = null;

        if (pipe[p].Documentation != null) {
            console.log(pipe[p].Documentation);
            docText = pipe[p].Documentation;
        }

        return docText;
    }

    generateSinglePipe(pipe, forwards) {
        let name = pipe['@name'];
        this.addPipe(name);

        if (pipe.Forward != null) {
            let forwardData = null;
            if (Array.isArray(pipe.Forward)) {
                pipe.Forward.forEach(function (item, index) {
                    forwardData = {
                        sourcePipe: name,
                        targetPipe: item['@path'],
                        name: item['@name']
                    };
                    forwards.push(forwardData);
                });
            } else {
                forwardData = {
                    sourcePipe: name,
                    targetPipe: pipe.Forward['@path'],
                    name: pipe.Forward['@name']
                };
                forwards.push(forwardData);
            }
        }

        return forwards;
    }

    checkPossitions(xpos, ypos) {
        if (xpos == null && ypos != null) {
            xpos = ypos;
        } else if (ypos == null && xpos != null) {
            ypos = xpos;
        }
        if (xpos != null && ypos != null) {
            return {
                x: xpos,
                y: ypos
            }
        } else {
            return null;
        }
    }
}