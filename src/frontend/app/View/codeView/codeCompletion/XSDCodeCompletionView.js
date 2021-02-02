import XsdManager from 'monaco-xsd-code-completion/esm/XsdManager'
import XsdFeatures from 'monaco-xsd-code-completion/esm/XsdFeatures'
import 'monaco-xsd-code-completion/src/style.css'

export default class XSDCodeCompletionView {

    constructor(monaco, editor, xsdModel) {
        xsdModel.addListener(this);
        this.monaco = monaco;
        this.editor = editor;
    }

    notify(data) {
      const xsdManager = new XsdManager(this.editor);

      // TODO: Use the real path as used in the configurations.
      //  This should be loaded dynamically. (xsdManager.update())
      xsdManager.set({
        path: 'ibisdoc.xsd',
        value: data,
        namespace: 'xs',
        nonStrictPath: true,
        includeIfRootTag: ['Configuration', 'Module', 'Adapter'],
      });

      const xsdFeatures = new XsdFeatures(xsdManager, this.monaco, this.editor);
      xsdFeatures.addCompletion();
      xsdFeatures.addValidation();
      xsdFeatures.addGenerateAction();
      xsdFeatures.addReformatAction();
    }
}
