import XsdManager from 'monaco-xsd-code-completion/esm/XsdManager'
import XsdFeatures from 'monaco-xsd-code-completion/esm/XsdFeatures'

export default class XSDCodeCompletionView {

    constructor(monaco, xsdModel) {
        xsdModel.addListener(this)
        this.monaco = monaco;
    }

    notify(data) {
      const xsdManager = new XsdManager()

      // TODO: Use the real path as used in the configurations.
      //  This should be loaded dynamically. (xsdManager.update())
      xsdManager.set({
        path: '../../../ibisdoc.xsd',
        value: data,
        namespace: 'xs',
      })

      const xsdFeatures = new XsdFeatures(xsdManager, monaco)

      xsdFeatures.addCompletion()
    }



}


