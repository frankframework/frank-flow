import PipeView from "./PipeView";
import PipeService from "../../../services/PipeService";

export default class ActivityPipeView extends PipeView {

    constructor() {
        super(null);
        this.pipeService = new PipeService()

        this.pipeService.getPipeWithActivity();

    }
}