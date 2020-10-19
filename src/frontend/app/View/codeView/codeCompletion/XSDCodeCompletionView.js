import XSDParser from 'monaco-xsd-code-completion/lib/XSDParser';
import XSDCodeCompletionProvider from 'monaco-xsd-code-completion/lib/XSDCodeCompletionProvider';

export default class XSDCodeCompletionView {

    constructor(monaco, xsdModel) {
        xsdModel.addListener(this)
        this.monaco = monaco;
    }

    notify(data) {
        console.log(data);
        const ibisdoc = new XSDParser(data)
        const xsdCodeCompletion = new XSDCodeCompletionProvider(ibisdoc)
        this.monaco.languages.registerCompletionItemProvider('xml', xsdCodeCompletion.provider())
    }



}


