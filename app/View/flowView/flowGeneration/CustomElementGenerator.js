import PipeBuilder from '../PipeBuilder.js'

export default class CustomElementGenerator {
    constructor(flowView) {
        this.flowView = flowView;
    }

    addReceiver(receiver, target) {
        let xCord,
            yCord,
            prependText = '(receiver): ';

        if (receiver['@x'] != null && receiver['@y'] != null) {
            xCord = receiver['@x'];
            yCord = receiver['@y']
        } else {
            xCord = 600;
            yCord = 400;
        }

        let name = prependText + receiver['@name'],
            positions = {
                x: xCord,
                y: yCord
            }
        new PipeBuilder(this.flowView, name)
            .withPositions(positions)
            .build();

        return {
            sourcePipe: prependText + receiver['@name'],
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
            new PipeBuilder(this.flowView, name)
            .withPositions(positions)
            .isExit(true)
            .build();
        }
    }
}