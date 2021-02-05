import XsdManager from 'monaco-xsd-code-completion/esm/XsdManager'
import XsdFeatures from 'monaco-xsd-code-completion/esm/XsdFeatures'
import 'monaco-xsd-code-completion/src/style.css'

export default class XSDCodeCompletionView {

    constructor(monaco, editor, xsdModel) {
        xsdModel.addListener(this);
        this.monaco = monaco;
        this.editor = editor;

        this.xsdManager = new XsdManager(this.editor);

        this.xsdFeatures = new XsdFeatures(this.xsdManager, this.monaco, this.editor);
        this.xsdFeatures.addCompletion();
        this.xsdFeatures.addValidation();
        this.xsdFeatures.addGenerateAction();
        this.xsdFeatures.addReformatAction();
    }

    notify(path, data) {

      // TODO: Use the real path as used in the configurations.
      //  This should be loaded dynamically. (xsdManager.update())
      this.xsdManager.set({
        path: path,
        value: data,
        namespace: 'xs',
        nonStrictPath: true,
        includeIfRootTag: ['Configuration', 'Module', 'Adapter'],
      });


    }
}
