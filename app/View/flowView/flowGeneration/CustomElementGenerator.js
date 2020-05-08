export default class CustomElementGenerator {
    constructor(pipeGenerator) {
        this.pipeGenerator = pipeGenerator;
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

        this.pipeGenerator.addPipe(prependText + transformedXml.Adapter.Receiver['@name'], {
            x: xCord,
            y: yCord
        });

        return {
            sourcePipe: prependText + transformedXml.Adapter.Receiver['@name'],
            targetPipe: target,
            name: 'request'
        };
    }


    addExits(exits) {
        let exit = exits,
            possitions,
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
                    possitions = {
                        x: xpos,
                        y: ypos
                    }
                }
                cur.pipeGenerator.addPipe(name, possitions, "", true);
            });
        } else {
            name = exit['@path'],
                xpos = exit['@x'],
                ypos = exit['@y'];
            if (xpos != null && ypos != null) {
                possitions = {
                    x: xpos,
                    y: ypos
                }
            }
            this.pipeGenerator.addPipe(name, possitions, "", true);
        }
    }
}