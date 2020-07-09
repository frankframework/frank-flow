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
        console.log(this.name)

    }

    generateActivities(data) {
        let types = this.flowView.getTypes();
        console.log(types[this.name])

        data.pipe.forEach(function(item, index) {
            console.log(item);
        })
    }
}