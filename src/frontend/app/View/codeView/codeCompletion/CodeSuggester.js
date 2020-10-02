import CodeSuggestionCache from './CodeSuggestionCache'
import TurndownService from 'turndown'

export default class CodeSuggester {
    constructor(xsd) {
        this.codeSuggestionCache = new CodeSuggestionCache(xsd)
        this.turndownService = new TurndownService()
    }

    elements = (parentElement, withoutTag = false, incomplete = false) =>
        this.parseElements(this.codeSuggestionCache.elements(parentElement), withoutTag, incomplete)

    parseElements = (elements, withoutTag, incomplete) =>
        elements.map((element) => ({
            label: element.name,
            insertText: this.parseElementInputText(element.name, withoutTag, incomplete),
            kind: monaco.languages.CompletionItemKind.Method,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        }))

    parseElementInputText = (name, withoutTag, incomplete) => {
        if (withoutTag) return '<' + name + '${1}></' + name + '>'
        if (incomplete) return name

        return name + '${1}></' + name
    }

    attributes = (parentElement) =>
        this.parseAttributes(this.codeSuggestionCache.attributes(parentElement))

    parseAttributes = (attributes) =>
        attributes.map((attribute) => ({
            label: attribute.name,
            insertText: attribute.name + '="${1}"',
            detail: attribute.type.replace('xs:', ''),
            preselect: attribute.use === 'required',
            kind: monaco.languages.CompletionItemKind.Variable,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: this.parseAttributeDocumentation(attribute.documentation),
        }))

    parseAttributeDocumentation = (documentation) => ({
        value: documentation ? this.turndownService.turndown(documentation) : '',
        isTrusted: true,
    })
}
