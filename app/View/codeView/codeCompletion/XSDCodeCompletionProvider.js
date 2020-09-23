import CodeSuggester from './CodeSuggester'

export default class XSDCodeCompletionProvider {
    CompletionType = {
        none: 0,
        element: 1,
        attribute: 2,
        incompleteElement: 3,
        closingElement: 4,
    }

    constructor(xsd) {
        this.codeSuggester = new CodeSuggester(xsd)
    }

    provider = () => ({
        triggerCharacters: ['<', ' ', '/'],
        provideCompletionItems: (model, position) => ({
            suggestions: this.getSuggestions(model, position),
        }),
    })

    getSuggestions = (model, position) => {
        const lastTag = this.getLastTag(model, position)
        const completionType = this.getCompletionType(model, position)

        switch (completionType) {
            case this.CompletionType.none:
                return this.codeSuggester.elements(lastTag, true)
            case this.CompletionType.element:
                return this.codeSuggester.elements(lastTag)
            case this.CompletionType.attribute:
                return this.codeSuggester.attributes(lastTag)
            case this.CompletionType.incompleteElement:
                return this.codeSuggester.elements(lastTag, false, true)
            case this.CompletionType.closingElement:
                return [{ label: lastTag, insertText: lastTag }]
        }
    }

    getLastTag = (model, position) => {
        const parentTags = this.getParentTags(model, position)
        const wordAtPosition = this.getWordAtPosition(model, position)
        return wordAtPosition === parentTags[parentTags.length - 1]
            ? parentTags[parentTags.length - 2]
            : parentTags[parentTags.length - 1]
    }

    getParentTags = (model, position) => {
        const textUntilPosition = this.getTextUntilPosition(model, position)
        const tags = this.getTagsFromText(textUntilPosition)

        const parentTags = []
        tags.map((tag) => {
            if (parentTags.includes(tag)) {
                while (parentTags[parentTags.length - 1] !== tag) {
                    parentTags.pop()
                }
                parentTags.pop()
            } else {
                parentTags.push(tag)
            }
        })
        return parentTags
    }

    getWordAtPosition = (model, position) =>
        model.getWordAtPosition(position) !== null ? model.getWordAtPosition(position).word : ''

    getTextUntilPosition = (model, position) =>
        model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
        })

    getTagsFromText = (text) => {
        const regexForTags = /(?<=<|<\/)[^\s|/>]+(?!.+\/>)/g
        const matches = text.match(regexForTags)
        if (matches) return [...matches]
    }

    getCompletionType = (model, position) => {
        const characterBeforePosition = this.getCharacterBeforePosition(model, position)

        if (characterBeforePosition === '<') return this.CompletionType.element
        if (characterBeforePosition === ' ') return this.CompletionType.attribute
        if (characterBeforePosition === '/') return this.CompletionType.closingElement

        const wordsBeforePosition = this.getWordsBeforePosition(model, position)

        if (this.textContainsAttributes(wordsBeforePosition)) return this.CompletionType.attribute
        if (this.textContainsTags(wordsBeforePosition)) return this.CompletionType.incompleteElement

        return this.CompletionType.none
    }

    getCharacterBeforePosition = (model, position) =>
        model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: position.column - 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
        })

    getWordsBeforePosition = (model, position) =>
        model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 0,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
        })

    textContainsAttributes = (text) => typeof this.getAttributesFromText(text) !== 'undefined'

    getAttributesFromText = (text) => {
        const regexForAttributes = /(?<=\s)[A-Za-z0-9]+/g
        const matches = text.match(regexForAttributes)
        if (matches) return [...matches]
    }

    textContainsTags = (text) => typeof this.getTagsFromText(text) !== 'undefined'
}
