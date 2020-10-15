import PipeView from "./PipeView";
import PipeService from "../../../Services/PipeService";

export default class ActivityPipeView extends PipeView {

    constructor(flowView, name, positions, extra, exit, descText) {
        super(flowView, name, positions, extra, exit, descText);
        this.getPipes();
    }

    async getPipes() {
        this.pipeService = new PipeService()
        let data = await this.pipeService.getPipeWithActivity();
        this.generateActivities(data)


    }

    generateActivities(data) {
        let name = this.name,
            activity = "";
        this.flowView.notifyListeners({ type: "getPipeAttributes", name: name, pipeModel: this.pipeModel });
        let cur = this;
        data.pipe.forEach(function (item, index) {
            if (item.name == cur.pipeModel.type) {
                for (let attr in cur.pipeModel.attributes) {
                    if (attr == item.keyword) {
                        console.log("match!", cur.pipeModel.attributes[attr])
                        activity = cur.pipeModel.attributes[attr];
                        cur.createTibcoImage(activity);
                    }
                }
            }
        })
        return activity;
    }

    createTibcoImage(activity) {
        if (activity != "") {
            $(this.element).find('div').remove('.typeWindow')
            let typeWindow = $('<div></div>').addClass("typeWindow").append(this.typeImageView.getTibcoImage(activity));
            $(this.element).find('div').append(typeWindow);

        }
    }

    checkForExitOrReceiver(el, bottomContainer) {
        let typeWindow = $('<div></div>').addClass("typeWindow").append(this.getTypeImage()),
            nameText = $("<strong></strong>").attr("id", "strong").text(this.name),
            extraText = $("<strong></strong>").attr("id", "strong").text(this.extra);

        this.isExit ? bottomContainer.append(nameText, extraText) : bottomContainer.append(nameText);

        if (this.isExit) {
            el.append(bottomContainer);
            
            $(el).css({
                width: 'auto',
                height: 'auto',
                border: '1px solid black'
            })

        } else {
            el.append(typeWindow, bottomContainer);

            $(el).css({
                width: 'auto',
                height: 'auto',
                border: '1px solid black'
            })
        }
        this.element = el;

        if(this.isExit) {
            this.pipeModel.type = "Exit";
            this.createTibcoImage("Exit")
          } else if (this.name.match(/\(receiver\):/g)) {
            this.pipeModel.type = "Receiver";
            this.createTibcoImage("Receiver")
          }
          

        return el;
    }
}