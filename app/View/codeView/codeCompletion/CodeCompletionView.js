export default class CodeCompletionView {

  constructor(codeView) {
    this.codeView = codeView;
    //this.initProvider();
  }

  // //setup the autocomplete.
  // initProvider() {
  //   let cur = this,
  //     suggestions;
  //   console.log('autocomplete working');
  //   monaco.languages.registerCompletionItemProvider('xml', {
  //     provideCompletionItems: function(model, position) {
  //       // find out if we are completing a property in the 'dependencies' object.
  //       var textUntilPosition = model.getValueInRange({
  //         startLineNumber: 1,
  //         startColumn: 1,
  //         endLineNumber: position.lineNumber,
  //         endColumn: position.column
  //       });
  //       let desiredPipe = textUntilPosition.match(/<[^"\/][\S]*?[pP]ipe/g);
  //       var match = model.getValue().match(/<[\S]*?[^"/][pP]ipe[\s\t\n][^]*?>[^]*?<[/][\S]*?[^"/]Pipe>/g);
  //       if (match == null || desiredPipe == null) {
  //         return;
  //       }
  //       desiredPipe = desiredPipe[desiredPipe.length - 1].replace(/</g, '');
  //       match.forEach(function(item, index) {
  //         let line = model.getLineContent(position.lineNumber - 1);
  //         if (item.indexOf(line) != -1) {
  //           suggestions = cur.createPipeAutoComplete();
  //         } else {
  //           suggestions = cur.createAttributeAutocomplete(desiredPipe);
  //         }
  //       });
  //       return {
  //         suggestions: suggestions
  //       };
  //     }
  //   });
  // }
  //
  // createPipeAutoComplete() {
  //   let pipe, obj = null;
  //   let arr = [];
  //
  //   if (this.codeView.ibisdocJson != null) {
  //     this.ibisdocJson = this.codeView.ibisdocJson;
  //     this.ibisdocJson[2].classes.forEach(function(item, index) {
  //       pipe = item;
  //       obj = {
  //         label: pipe.name.replace(/^((?!Pipe).)*$/, pipe.name + "Pipe"),
  //         kind: monaco.languages.CompletionItemKind.Function,
  //         documentation: pipe.packageName,
  //         insertText: '<' + pipe.name + ' name="yourPipe"> \n </' + pipe.name + '>'
  //       }
  //       arr.push(obj);
  //     });
  //   }
  //
  //   obj = {
  //     label: 'Forward',
  //     kind: monaco.languages.CompletionItemKind.Function,
  //     documentation: "a forward",
  //     insertText: '<Forward name="forwardName" path="newPath" />'
  //   }
  //   arr.push(obj);
  //   return arr;
  // }
  // createAttributeAutocomplete(selectPipe) {
  //   let arr = [],
  //     obj;
  //   if (this.codeView.ibisdocJson != null) {
  //     this.ibisdocJson = this.codeView.ibisdocJson;
  //     this.ibisdocJson[2].classes.forEach(function(pipe, index) {
  //                 //console.log(pipe.name.length, pipe.name, selectPipe.length);
  //       if (pipe.name == selectPipe) {
  //         pipe.methods.forEach(function(attr, index) {
  //           obj = {
  //             label: attr.name,
  //             kind: monaco.languages.CompletionItemKind.Function,
  //             documentation: attr.description,
  //             insertText: attr.name + '="' + attr.defaultValue + '"'
  //           }
  //           arr.push(obj);
  //         });
  //       }
  //     });
  //   }
  //   return arr;
  // }

  initProvider() {

    this.schemaNode = this.stringToXml(localStorage.getItem('ibisdocXsd').replace(/xs\:/g, '')).childNodes[0];
    console.log(this.schemaNode, "hoi");
    monaco.languages.registerCompletionItemProvider('xml', this.getXmlCompletionProvider(monaco));
  }

  stringToXml(text) {
    var xmlDoc;

    if (window.DOMParser) {
      var parser = new DOMParser();
      xmlDoc = parser.parseFromString(text, 'text/xml');
    } else {
      xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
      xmlDoc.async = false;
      xmlDoc.loadXML(text);
    }
    return xmlDoc;
  }

  getLastOpenedTag(text) {
    // get all tags inside of the content
    var tags = text.match(/<\/*(?=\S*)([a-zA-Z-]+)/g);
    if (!tags) {
      return undefined;
    }
    // we need to know which tags are closed
    var closingTags = [];
    for (var i = tags.length - 1; i >= 0; i--) {
      if (tags[i].indexOf('</') === 0) {
        closingTags.push(tags[i].substring('</'.length));
      } else {
        // get the last position of the tag
        var tagPosition = text.lastIndexOf(tags[i]);
        var tag = tags[i].substring('<'.length);
        var closingBracketIdx = text.indexOf('/>', tagPosition);
        // if the tag wasn't closed
        if (closingBracketIdx === -1) {
          // if there are no closing tags or the current tag wasn't closed
          if (!closingTags.length || closingTags[closingTags.length - 1] !== tag) {
            // we found our tag, but let's get the information if we are looking for
            // a child element or an attribute
            text = text.substring(tagPosition);
            return {
              tagName: tag,
              isAttributeSearch: text.indexOf('<') > text.indexOf('>')
            };
          }
          // remove the last closed tag
          closingTags.splice(closingTags.length - 1, 1);
        }
        // remove the last checked tag and continue processing the rest of the content
        text = text.substring(0, tagPosition);
      }
    }
  }

  getAreaInfo(text) {
    // opening for strings, comments and CDATA
    var items = ['"', '\'', '<!--', '<![CDATA['];
    var isCompletionAvailable = true;
    // remove all comments, strings and CDATA
    text = text.replace(/"([^"\\]*(\\.[^"\\]*)*)"|\'([^\'\\]*(\\.[^\'\\]*)*)\'|<!--([\s\S])*?-->|<!\[CDATA\[(.*?)\]\]>/g, '');
    for (var i = 0; i < items.length; i++) {
      var itemIdx = text.indexOf(items[i]);
      if (itemIdx > -1) {
        // we are inside one of unavailable areas, so we remote that area
        // from our clear text
        text = text.substring(0, itemIdx);
        // and the completion is not available
        isCompletionAvailable = false;
      }
    }
    console.log("completion available: ", isCompletionAvailable, text)
    return {
      isCompletionAvailable: isCompletionAvailable,
      clearedText: text
    };
  }

  shouldSkipLevel(tagName) {
    // if we look at the XSD schema, these nodes are containers for elements,
    // so we can skip that level
    return tagName === 'complexType' || tagName === 'all' || tagName === 'sequence';
  }

  findElements(elements, elementName) {
    for (var i = 0; i < elements.length; i++) {
      // we are looking for elements, so we don't need to process annotations and attributes
      if (elements[i].tagName !== 'annotation' && elements[i].tagName !== 'attribute') {
        // if it is one of the nodes that do not have the info we need, skip it
        // and process that node's child items
        if (this.shouldSkipLevel(elements[i].tagName)) {
          var child = this.findElements(elements[i].children, elementName);
          // if child exists, return it
          if (child) {
            return child;
          }
        }
        // if there is no elementName, return all elements (we'll explain
        // this bit little later
        else if (!elementName) {
          return elements;
        }
        // find all the element attributes, and if is't name is the same
        // as the element we're looking for, return the element.
        else if (this.getElementAttributes(elements[i]).name === elementName) {
          return elements[i];
        }
      }
    }
  }

  findAttributes(elements) {
    var attrs = [];
    for (var i = 0; i < elements.length; i++) {
      // skip level if it is a 'complexType' tag
      if (elements[i].tagName === 'complexType') {
        var child = this.findAttributes(elements[i].children);
        if (child) {
          return child;
        }
      }
      // we need only those XSD elements that have a
      // tag 'attribute'
      else if (elements[i].tagName === 'attribute') {
        attrs.push(elements[i]);
      }
    }
    return attrs;
  }

  getElementAttributes(element) {
    var attrs = {};
    for (var i = 0; i < element.attributes.length; i++) {
      attrs[element.attributes[i].name] = element.attributes[i].value;
    }
    // return all attributes as an object
    return attrs;
  }

  getItemDocumentation(element) {
    for (var i = 0; i < element.children.length; i++) {
      // annotaion contains documentation, so calculate the
      // documentation from it's child elements
      if (element.children[i].tagName === 'annotation') {
        return this.getItemDocumentation(element.children[0]);
      }
      // if it's the documentation element, just get the value
      else if (element.children[i].tagName === 'documentation') {
        return element.children[i].textContent;
      }
    }
  }

  isItemAvailable(itemName, maxOccurs, items) {
    // the default for 'maxOccurs' is 1
    maxOccurs = maxOccurs || '1';
    // the element can appere infinite times, so it is availabel
    if (maxOccurs && maxOccurs === 'unbounded') {
      return true;
    }
    // count how many times the element appered
    var count = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i] === itemName) {
        count++;
      }
    }
    // if it didn't appear yet, or it can appear again, then it
    // is available, otherwise it't not
    return count === 0 || parseInt(maxOccurs) > count;
  }

  getAvailableElements(monaco, elements, usedItems) {
    var availableItems = [];
    var children;
    for (var i = 0; i < elements.length; i++) {
      // annotation element only contains documentation,
      // so no need to process it here
      if (elements[i].tagName !== 'annotation') {
        // get all child elements that have 'element' tag
        children = this.findElements([elements[i]])
      }
    }
    // if there are no such elements, then there are no suggestions
    if (!children) {
      return [];
    }
    for (var i = 0; i < children.length; i++) {
      // get all element attributes
      let elementAttrs = this.getElementAttributes(children[i]);
      // the element is a suggestion if it's available
      if (this.isItemAvailable(elementAttrs.name, elementAttrs.maxOccurs, usedItems)) {
        // mark it as a 'field', and get the documentation
        availableItems.push({
          label: elementAttrs.name,
          kind: monaco.languages.CompletionItemKind.Field,
          detail: elementAttrs.type,
          documentation: this.getItemDocumentation(children[i])
        });
      }
    }
    // return the suggestions we found
    return availableItems;
  }

  getAvailableAttribute(monaco, elements, usedChildTags) {
    var availableItems = [];
    var children;
    for (var i = 0; i < elements.length; i++) {
      // annotation element only contains documentation,
      // so no need to process it here
      if (elements[i].tagName !== 'annotation') {
        // get all child elements that have 'attribute' tag
        children = this.findAttributes([elements[i]])
      }
    }
    // if there are no attributes, then there are no
    // suggestions available
    if (!children) {
      return [];
    }
    for (var i = 0; i < children.length; i++) {
      // get all attributes for the element
      var attrs = this.getElementAttributes(children[i]);
      // accept it in a suggestion list only if it is available
      if (this.isItemAvailable(attrs.name, attrs.maxOccurs, usedChildTags)) {
        // mark it as a 'property', and get it's documentation
        availableItems.push({
          label: attrs.name,
          kind: monaco.languages.CompletionItemKind.Property,
          detail: attrs.type,
          documentation: this.getItemDocumentation(children[i])
        });
      }
    }
    // return the elements we found
    return availableItems;
  }

  getXmlCompletionProvider(monaco) {
    let cur = this;
    return {
      triggerCharacters: ['<'],
      provideCompletionItems: function(model, position) {
        // get editor content before the pointer
        var textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        // get content info - are we inside of the area where we don't want suggestions, what is the content without those areas
        var areaUntilPositionInfo = cur.getAreaInfo(textUntilPosition); // isCompletionAvailable, clearedText
        console.log("position: ", areaUntilPositionInfo);
        // if we don't want any suggestions, return empty array
        if (!areaUntilPositionInfo.isCompletionAvailable) {
          return [];
        }
        // if we want suggestions, inside of which tag are we?
        var lastOpenedTag = cur.getLastOpenedTag(areaUntilPositionInfo.clearedText);
        console.log("last opened tag: ", lastOpenedTag);
        // get opened tags to see what tag we should look for in the XSD schema
        var openedTags = [];
        // get the elements/attributes that are already mentioned in the element we're in
        var usedItems = [];
        var isAttributeSearch = lastOpenedTag && lastOpenedTag.isAttributeSearch;
        // no need to calculate the position in the XSD schema if we are in the root element
        if (lastOpenedTag) {
          // parse the content (not cleared text) into an xml document
          var xmlDoc = cur.stringToXml(model.getValue());
          var lastChild = xmlDoc.lastElementChild;
          console.log(xmlDoc);
          while (lastChild) {
            openedTags.push(lastChild.tagName);
            // if we found our last opened tag
            if (lastChild.tagName === lastOpenedTag.tagName) {
              // if we are looking for attributes, then used items should
              // be the attributes we already used
              if (lastOpenedTag.isAttributeSearch) {
                var attrs = lastChild.attributes;
                for (var i = 0; i < attrs.length; i++) {
                  usedItems.push(attrs[i].nodeName);
                }
              } else {
                // if we are looking for child elements, then used items
                // should be the elements that were already used
                var children = lastChild.children;
                for (var i = 0; i < children.length; i++) {
                  usedItems.push(children[i].tagName);
                }
              }
              break;
            }
            // we haven't found the last opened tag yet, so we move to
            // the next element
            lastChild = lastChild.lastElementChild;
          }
        }
        // find the last opened tag in the schema to see what elements/attributes it can have
        var currentItem = this.schemaNode;
        for (var i = 0; i < openedTags.length; i++) {
          if (currentItem) {
            currentItem = cur.findElements(currentItem.children, openedTags[i]);
          }
        }

        // return available elements/attributes if the tag exists in the schema, or an empty
        // array if it doesn't
        if (isAttributeSearch) {
          // get attributes completions
          return currentItem ? cur.getAvailableAttribute(monaco, currentItem.children, usedItems) : [];
        } else {
          // get elements completions
          return currentItem ? cur.getAvailableElements(monaco, currentItem.children, usedItems) : [];
        }
      }
    }
  }
}
