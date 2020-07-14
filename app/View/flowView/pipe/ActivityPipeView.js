import PipeView from "./PipeView";
import PipeService from "../../../services/PipeService";

export default class ActivityPipeView extends PipeView {

    constructor(flowView, name, positions, extra, exit, descText) {
        super(flowView, name, positions, extra, exit, descText);
        this.pipeService = new PipeService()

        this.getPipes();
    }

    async getPipes() {
        let data = await this.pipeService.getPipeWithActivity();
        this.generateActivities(data)

    }

    generateActivities(data) {
        let name = this.name;
        let types = this.flowView.getTypes();
        this.flowView.notifyListeners({ type: "getPipeAttributes", name: name, pipeModel: this.pipeModel });
        let cur = this;
        data.pipe.forEach(function (item, index) {
            for (let attr in cur.pipeModel.attributes) {
                if (attr == item.keyword) {
                    console.log("match!")
                }
            }
        })
    }

    checkForExitOrReceiver(el, bottomContainer) {
        let typeWindow = $('<div></div>').addClass("typeWindow").append(this.getTypeImage()),
            nameText = $("<strong></strong>").attr("id", "strong").text(this.name),
            extraText = $("<strong></strong>").attr("id", "strong").text(this.extra);

        this.isExit ? bottomContainer.append(nameText, extraText) : bottomContainer.append(nameText);

        if (this.isExit | this.types['receiver ' + this.name.replace('(receiver): ', '')] == "Receiver") {
            el.append(bottomContainer);
        } else {
            el.append(typeWindow, bottomContainer);

            $(el).css({
                width: 'auto',
                height: 'auto',
                border: 'none'
            })
        }

        return el;
    }
}