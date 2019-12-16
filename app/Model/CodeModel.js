export default class CodeModel {
  constructor() {
    this.initAdapter();
  }

  initAdapter() {
    this.adapter = [
      '<Adapter',
      '	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      '	xsi:noNamespaceSchemaLocation="https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.xsd"',
      '	name="HelloWorld" ',
      '	description="Voorbeeld adapter">',

      '	<Receiver name="HelloWorld">',
      '		<ApiListener name="HelloWorld"',
      '			uriPattern="helloworld/{inputString}"',
      '			method = "get"',
      '		/>',
      '	</Receiver>',

      '	<Pipeline firstPipe="SwitchInput">',
      '		<XmlSwitchPipe name="SwitchInput"',
      '			getInputFromFixedValue="&lt;dummy/&gt;"',
      '			xpathExpression="$input" x="436" y="131">',
      '			<Param name="input" sessionKey="inputString"></Param>',
      '		</XmlSwitchPipe>\n\n',
      '		<FixedResultPipe',
      '			name="NFHelloWorld"',
      '			returnString="Hallo Ricardo !"',
      '		 	x="863" y="228">',
      '			<Forward name="success" path="Exit"/>',
      '		</FixedResultPipe>\n',

      '		<Exit path="ServerError" state="error" code="500"/>',
      '		<Exit path="Exit" state="success" code="201"/>',
      '	</Pipeline>',
      '</Adapter>'
    ];
  }
}
