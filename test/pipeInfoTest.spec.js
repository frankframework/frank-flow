import PipeInfoView from "../app/View/pipeInfoView/PipeInfoView.js"
import FlowModelMock from "./Mock/FlowModelMock.js";

let mockPipeInfoView = new PipeInfoView(new FlowModelMock());
let FIXEDRESULT = "FixedResult";
let CHECKEMPTYMESSAGE = "CheckEmptyMessage";
let APIPRINCIPALPIPE = "ApiPrincipalPipe";

beforeEach(() => {
   document.body.innerHTML = window.__html__['index'];
})

describe("check default values", () => {

   it("check pipe name, should be FixedResult", () => {
      expect(mockPipeInfoView.pipeName).toBe(FIXEDRESULT);
   })

   it("check pipe type, should be CheckEmptyMessage", () => {
      expect(mockPipeInfoView.pipeType).toBe(CHECKEMPTYMESSAGE);
   })
})

describe("test generation of the tab menu", () => {

   it('when generating types, should be ApiPrincipalPipe', () => {
      //arrange
      let mockIbisDoc = {
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

      //act
      mockPipeInfoView.generateTypes(mockIbisDoc);

      //assert
      expect($('#typeSelect').val()).toBe(APIPRINCIPALPIPE);
   })

   it("when generating parameters, should be userAgent", () => {
      //arrange
      let mockParams = [
         {
            name: "userAgent", 
            sessionKey: "userAgent" 
         }
      ]

      //act
      mockPipeInfoView.generatePipeParameters(mockParams);

      //assert
      expect($('#name').val()).toBe(mockParams[0].name);
   })

   it("when generating attributes, should be ShowConfigurationStatus/xsl/ShowConfigurationStatus.xsl", () => {
      //arrange
      let mockAttributes = {
         name: "showConfigurationStatus",
         styleSheetName: "ShowConfigurationStatus/xsl/ShowConfigurationStatus.xsl"
      }

      //act
      mockPipeInfoView.generatePipeAttributes(mockAttributes);
      console.log("input: ", $('#attributeVal').val());

      //assert
      expect($('#attributeVal').val()).toBe(mockAttributes.styleSheetName);
   })
})