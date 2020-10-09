export default class CodeSuggestionCache {
    xsd
    elementCollections = []
    attributeCollections = []

    constructor(xsd) {
        this.xsd = xsd
    }

    elements = (parentElement) =>
        typeof parentElement === 'undefined' ? this.rootElements() : this.subElements(parentElement)

    rootElements = () => this.elementCollections['rootElements'] || this.getRootElements()

    getRootElements = () => {
        console.log(`Fetch root elements from XSD`)
        this.elementCollections['rootElements'] = this.xsd.getRootElements()
        return this.elementCollections['rootElements']
    }

    subElements = (parentElement) =>
        this.elementCollections[parentElement] || this.getSubElements(parentElement)

    getSubElements = (parentElement) => {
        console.log(`Fetch sub elements for ${parentElement} from XSD`)
        this.elementCollections[parentElement] = this.xsd.getSubElements(parentElement)
        return this.elementCollections[parentElement]
    }

    attributes = (element) => this.attributeCollections[element] || this.getAttributes(element)

    getAttributes = (element) => {
        console.log(`Fetch attributes for ${element} from XSD`)
        this.attributeCollections[element] = this.xsd.getAttributesForElement(element)
        return this.attributeCollections[element]
    }
}
