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
        console.log(name, types[this.name])
        console.log(this.flowView.notifyListeners({type: "getPipeAttributes", name: name, pipeModel: this.pipeModel}));
        console.log(this.pipeModel.attributes)

        data.pipe.forEach(function(item, index) {
            //console.log(item);
        })
    }
}