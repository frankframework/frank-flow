import PipeView from '../pipe/PipeView.js';
import ConsoleColorPick from '../../ConsoleColorPick.js';
import PipeGenerator from './PipeGenerator.js';

export default class FlowGenerator {
  constructor(flowView, flowModel) {
    this.flowModel = flowModel;
    this.flowView = flowView;
    this.pipeGenerator = new PipeGenerator(flowModel, flowView);
    this.consoleColor = new ConsoleColorPick();
    this.pipes = {};
  }

  /*
  # if the pipeline is not null empty the canvas
  # for pipe is not null generate each pipe
  # if there is only one pipe only generate that one
  # push all forwards to the forwards array and generate the forwards
  */

  generateFlow(windows) {
    this.flowView.resetWindows();
    let transformedXml = this.flowModel.getTransformedXml();

    if (transformedXml != null && transformedXml.Adapter != null &&
      transformedXml.Adapter.Pipeline != null) {

      instance.reset();
      $('#canvas').empty();
      this.pipes = this.pipeGenerator.generateAllPipes(transformedXml);
    } else {
      this.flowView.displayError(transformedXml);
    }
  }
}
