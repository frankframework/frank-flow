import xpath from 'xpath'

export default class XSDParser {
    constructor(xsdString) {
        const Dom = require('xmldom').DOMParser
        this.xsdDOM = new Dom().parseFromString(xsdString)
        this.select = xpath.useNamespaces({
            xs: 'http://www.w3.org/2001/XMLSchema',
        })
    }

    getRootElements = () => this.parseElements(this.select(`/xs:schema/xs:element`, this.xsdDOM))

    getSubElements = (elementName) =>
        this.parseElements(
            this.select(`//xs:complexType[@name='${elementName}Type']//xs:element`, this.xsdDOM)
        )

    getAttributesForElement = (elementName) =>
        this.parseAttributes(
            this.select(`//xs:complexType[@name='${elementName}Type']/xs:attribute`, this.xsdDOM)
        )

    parseElements = (elements) => elements.map((element) => this.getAttributesForNode(element))

    parseAttributes = (attributes) =>
        attributes.map((attribute) => ({
            ...this.getAttributesForNode(attribute),
            ...this.getDocumentationForNode(attribute)[0],
        }))

    getAttributesForNode = (node) =>
        this.select('@*', node).reduce((acc, curr) => ({ ...acc, [curr.name]: curr.value }), {})

    getDocumentationForNode = (attribute) =>
        this.select(`xs:annotation/xs:documentation`, attribute).map((documentation) =>
            documentation.firstChild ? { documentation: documentation.firstChild.data } : null
        )
}
