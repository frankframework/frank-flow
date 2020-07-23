import PipeInfoView from "../app/View/pipeInfoView/PipeInfoView.js"
import FlowModelMock from "./Mock/FlowModelMock.js";

document.body.innerHTML = window.__html__['index']; 

let mockPipeInfoView = new PipeInfoView(new FlowModelMock());

let mockIbisDoc = {
   0: {},
   1: {},
   2: {
      classes: [
         {
            name: "ApiPrincipalPipe"
         }, {
            name: "ApiSoapWrapperPipe"
         }
      ]
   }
}

describe("check default values", () => {

   console.log(mockPipeInfoView)
 it("check pipe name", () => {
    expect(mockPipeInfoView.pipeName).toBe("FixedResult");
 })

 it("check pipe type", () => {
   expect(mockPipeInfoView.pipeType).toBe("CheckEmptyMessage");
 })
})

describe("test generation", () => {

   it('check type generation', () => {
      mockPipeInfoView.generateTypes(mockIbisDoc);
      console.log($('#typeSelect').val())
      expect($('#typeSelect').val()).toBe('ApiPrincipalPipe')
   })
})