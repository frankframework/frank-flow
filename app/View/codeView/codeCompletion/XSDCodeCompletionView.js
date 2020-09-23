import XSDParser from './XSDParser.js'
// import * as monaco from 'monaco-editor'
import XSDCodeCompletion from './XSDCodeCompletionProvider'

export default class XSDCodeCompletionView {

    constructor(monaco, xsdModel) {
        xsdModel.addListener(this)
        this.monaco = monaco;
    }

    notify(data) {
        console.log(data);
        const ibisdoc = new XSDParser(data)
        const xsdCodeCompletion = new XSDCodeCompletion(ibisdoc)
        this.monaco.languages.registerCompletionItemProvider('xml', xsdCodeCompletion.provider())
    }



}


