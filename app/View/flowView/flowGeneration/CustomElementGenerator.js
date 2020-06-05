import PipeBuilder from '../PipeBuilder.js'

export default class CustomElementGenerator {
    constructor(flowView) {
        this.flowView = flowView;
    }

    addReceiver(transformedXml, target) {
        let xCord,
            yCord,
            prependText = '(receiver): ';

        if (transformedXml.Adapter.Receiver['@x'] != null && transformedXml.Adapter.Receiver['@y'] != null) {
            xCord = transformedXml.Adapter.Receiver['@x'];
            yCord = transformedXml.Adapter.Receiver['@y']
        } else {
            xCord = 600;
            yCord = 400;
        }

        // this.pipeGenerator.addPipe(prependText + transformedXml.Adapter.Receiver['@name'], {
        //     x: xCord,
        //     y: yCord
        // });

        let name = prependText + transformedXml.Adapter.Receiver['@name'],
            positions = {
                x: xCord,
                y: yCord
            }
        new PipeBuilder(this.flowView, name)
            .withPositions(positions)
            .build();

        return {
            sourcePipe: prependText + transformedXml.Adapter.Receiver['@name'],
            targetPipe: target,
            name: 'request'
        };
    }


    addExits(exits) {
        let exit = exits,
            positions,
            name,
            ypos,
            xpos;

        if (exit == null) {
            return;
        }

        if (Array.isArray(exit)) {
            let cur = this;
            exit.forEach(function (item, index) {
                name = exit[index]['@path'],
                    xpos = exit[index]['@x'],
                    ypos = exit[index]['@y'];
                if (xpos != null && ypos != null) {
                    positions = {
                        x: xpos,
                        y: ypos
                    }
                }
                // cur.pipeGenerator.addPipe(name, positions, "", true);
                new PipeBuilder(cur.flowView, name)
                    .withPositions(positions)
                    .isExit(true)
                    .build();
            });
        } else {
            name = exit['@path'],
                xpos = exit['@x'],
                ypos = exit['@y'];
            if (xpos != null && ypos != null) {
                positions = {
                    x: xpos,
                    y: ypos
                }
            }
            // this.pipeGenerator.addPipe(name, positions, "", true);
            new PipeBuilder(this.flowView, name)
            .withPositions(positions)
            .isExit(true)
            .build();
        }
    }
}