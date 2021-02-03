import PipeGenerator from './PipeGenerator.js';

export default class FlowGenerator {
  constructor(flowView, flowModel) {
    this.flowModel = flowModel;
    this.flowView = flowView;
    this.pipeGenerator = new PipeGenerator(flowModel, flowView);
    this.pipes = {};
  }

  /*
  # if the pipeline is not null empty the canvas
  # for pipe is not null generate each pipe
  # if there is only one pipe only generate that one
  # push all forwards to the forwards array and generate the forwards
  */

  generateFlow() {
    this.flowView.resetWindows();
    let transformedXml = this.flowModel.getTransformedXml();

    if (transformedXml != null && transformedXml.Adapter != null &&
      transformedXml.Adapter.Pipeline != null) {

      instance.reset();
      $('#canvas').empty();
      this.pipes = this.pipeGenerator.generateAllPipes(transformedXml);
    } else if(Array.isArray(transformedXml.Adapter)) {
      
      let tempAdapter = null;
      
      transformedXml.Adapter.forEach(function(item, index) {
        if(item['@name'] == localStorage.getItem('currentAdapter')) {
          tempAdapter = item;
        }
      })
      if(tempAdapter != null) {
        transformedXml.Adapter = tempAdapter;
      }

      instance.reset();
      $('#canvas').empty();
      this.pipes = this.pipeGenerator.generateAllPipes(transformedXml);
    } else {
      console.log("Error: ", transformedXml);
      this.flowView.displayError(transformedXml);
    }
  }
}
