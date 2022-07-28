import { Injectable } from '@angular/core';
import { CompletionType, ICompletion } from './frank-doc-code-completion.types';
import { FrankDocParser } from '../../shared/services/frank-doc-parser.service';
import { Element } from '../../shared/models/frank-doc.model';
import TurndownService from 'turndown';

@Injectable({
  providedIn: 'root',
})
export class FrankDocCodeCompletionService {
  private turndownService = new TurndownService();

  constructor(private frankDocParser: FrankDocParser) {}

  public provider = (): monaco.languages.CompletionItemProvider => ({
    triggerCharacters: ['<', ' ', '/'],
    provideCompletionItems: (
      model: monaco.editor.ITextModel,
      position: monaco.Position,
      context: monaco.languages.CompletionContext
    ): monaco.languages.ProviderResult<monaco.languages.CompletionList> => ({
      suggestions: this.getCompletionItems(model, position, context),
    }),
  });

  private getCompletionItems = (
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.CompletionContext
  ): monaco.languages.CompletionItem[] => {
    const completions: ICompletion[] = this.getCompletions(
      model,
      position,
      context
    );
    const wordUntilPosition = model.getWordUntilPosition(position);
    const tagBeforePosition = this.getLastTagBeforePosition(model, position);

    const startColumn = this.getStartColumnForTagWithNamespace(
      wordUntilPosition,
      tagBeforePosition
    );
    const wordRange = {
      startColumn: startColumn,
      startLineNumber: position.lineNumber,
      endColumn: wordUntilPosition.endColumn,
      endLineNumber: position.lineNumber,
    };

    return completions.map(
      (completion: ICompletion): monaco.languages.CompletionItem => {
        return {
          ...completion,
          range: wordRange,
        };
      }
    );
  };

  private getCompletions = (
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.CompletionContext
  ): ICompletion[] | [] => {
    const wordsBeforePosition = this.getWordsBeforePosition(model, position);
    const textUntilPosition = this.getTextUntilPosition(model, position);
    const completionType = this.getCompletionType(
      wordsBeforePosition,
      textUntilPosition,
      context
    );
    if (completionType == CompletionType.none) return [];

    const parentTag = this.getParentTag(model, position);
    if (completionType == CompletionType.closingElement && parentTag)
      return this.getClosingElementCompletion(parentTag);
    const parentTagName = this.getTagName(parentTag);

    return this.doCompletion(
      completionType,
      parentTagName ?? parentTag,
      wordsBeforePosition
    );
  };

  private getCompletionType = (
    wordsBeforePosition: string,
    textUntilPosition: string,
    context: monaco.languages.CompletionContext
  ): CompletionType => {
    if (this.isInsideAttributeValue(wordsBeforePosition)) {
      return CompletionType.attributeValue;
    }

    switch (context.triggerKind) {
      case monaco.languages.CompletionTriggerKind.Invoke:
        const completionType =
          this.getCompletionTypeByPreviousText(textUntilPosition);
        if (completionType) return completionType;
        return this.getCompletionTypeForIncompleteCompletion(
          wordsBeforePosition
        );
      case monaco.languages.CompletionTriggerKind
        .TriggerForIncompleteCompletions:
        return this.getCompletionTypeForIncompleteCompletion(
          wordsBeforePosition
        );
      case monaco.languages.CompletionTriggerKind.TriggerCharacter:
        return this.getCompletionTypeByTriggerCharacter(
          context.triggerCharacter
        );
    }
  };

  private isInsideAttributeValue = (text: string): boolean => {
    const regexForInsideAttributeValue = /="[^"]*$/;
    const matches = text.match(regexForInsideAttributeValue);
    return !!matches;
  };

  private getCompletionTypeForIncompleteCompletion = (
    text: string
  ): CompletionType => {
    const currentTag = this.getTextFromCurrentTag(text);
    if (currentTag) {
      if (this.textContainsAttributes(currentTag))
        return CompletionType.incompleteAttribute;
      if (this.textContainsTags(currentTag))
        return CompletionType.incompleteElement;
    }
    return CompletionType.snippet;
  };

  private getTextFromCurrentTag = (text: string): string =>
    text.match(/(<\/*[^>]*)$/g)?.[0] || '';

  private textContainsAttributes = (text: string): boolean =>
    this.getAttributesFromText(text).length > 0;

  private getAttributesFromText = (text: string): string[] =>
    text.match(/(?<=\s)[\w-]+/g) || [];

  private textContainsTags = (text: string): boolean => {
    const tags = this.getTagsFromText(text);
    return tags !== undefined && tags.length > 0;
  };

  private getTagsFromText = (text: string): string[] | undefined =>
    text.match(/(?<=<|<\/)[^\s/>?|]+(?!.*\/>)/g) || [];

  private getCompletionTypeByTriggerCharacter = (
    triggerCharacter: string | undefined
  ): CompletionType => {
    switch (triggerCharacter) {
      case '<':
        return CompletionType.element;
      case ' ':
        return CompletionType.attribute;
      case '/':
        return CompletionType.closingElement;
    }
    return CompletionType.none;
  };

  private getCompletionTypeByPreviousText = (
    text: string
  ): CompletionType | undefined => {
    const lastCharacterBeforePosition = text[text.length - 1];
    switch (lastCharacterBeforePosition) {
      case '<':
        return CompletionType.incompleteElement;
      case ' ':
        return this.getCompletionTypeAfterWhitespace(text);
      case '/':
        return CompletionType.closingElement;
      default:
        return;
    }
  };

  private getCompletionTypeAfterWhitespace = (
    text: string
  ): CompletionType | undefined => {
    if (this.isInsideTag(text)) return CompletionType.attribute;
    if (this.isAfterTag(text)) return CompletionType.snippet;
    return;
  };

  private isInsideTag = (text: string): boolean =>
    this.getTextInsideCurrentTag(text).length > 0;

  private getTextInsideCurrentTag = (text: string): string[] =>
    text.match(/(?<=(<|<\/)[^\s/>?|]+)\s([\s\w"'=\-])*$/g) || [];

  private isAfterTag = (text: string): boolean =>
    this.getTextAfterCurrentTag(text).length > 0;

  private getTextAfterCurrentTag = (text: string) =>
    text.match(/(?<=>\s+)[^<]+$/g) || [];

  private getParentTag = (
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): string => {
    const textUntilPosition = this.getTextUntilPosition(model, position);
    const unclosedTags = this.getUnclosedTags(textUntilPosition);
    const wordAtPosition = model.getWordAtPosition(position);
    if (
      this.wordAtPositionIsEqualToLastUnclosedTag(wordAtPosition, unclosedTags)
    )
      return unclosedTags[unclosedTags.length - 2];

    const lastTagBeforePosition = this.getLastTagBeforePosition(
      model,
      position
    );
    const currentTagName = this.getTagName(lastTagBeforePosition);
    if (
      wordAtPosition &&
      currentTagName &&
      currentTagName === wordAtPosition.word
    ) {
      return unclosedTags[unclosedTags.length - 2];
    }
    return unclosedTags[unclosedTags.length - 1];
  };

  private getTextUntilPosition = (
    model: monaco.editor.ITextModel,
    position: monaco.IPosition
  ): string =>
    model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

  private getUnclosedTags = (text: string): string[] => {
    const tags = this.getTagsFromText(text);
    const parentTags: string[] = [];
    if (tags)
      tags.map((tag) => {
        if (parentTags.includes(tag)) {
          while (parentTags[parentTags.length - 1] !== tag) {
            parentTags.pop();
          }
          parentTags.pop();
        } else {
          parentTags.push(tag);
        }
      });
    return parentTags;
  };

  private wordAtPositionIsEqualToLastUnclosedTag = (
    wordAtPosition: monaco.editor.IWordAtPosition | null,
    unclosedTags: string[]
  ): boolean =>
    wordAtPosition !== null &&
    wordAtPosition.word === unclosedTags[unclosedTags.length - 1];

  private getTagName = (tag: string | undefined): string | undefined => {
    const currentTagParts = this.getTagParts(tag);
    return currentTagParts?.[1] || tag;
  };

  private getTagParts = (tag: string | undefined): string[] | undefined => {
    return tag?.split(':');
  };

  private doCompletion = (
    completionType: CompletionType,
    parentTagName: string,
    wordsUntilPosition: string
  ): ICompletion[] => {
    const element = this.frankDocParser.getElementByElementName(parentTagName);
    switch (completionType) {
      case CompletionType.element:
      case CompletionType.incompleteElement:
      case CompletionType.snippet:
        return this.getElements(element, completionType);
      case CompletionType.attribute:
      case CompletionType.incompleteAttribute:
        return this.getAttributes(element, completionType, wordsUntilPosition);
      case CompletionType.attributeValue:
        return this.getAttributeValues(element, wordsUntilPosition);
    }
    return [];
  };

  private getElements = (
    element: Element,
    completionType: CompletionType
  ): ICompletion[] => {
    let elements: Element[];
    elements = element
      ? this.frankDocParser.removeDuplicateElements(
          this.frankDocParser.getChildrenWithInheritance(element)
        )
      : [
          this.frankDocParser.getElement('Configuration'),
          this.frankDocParser.getElement('Module'),
        ];
    return elements.flatMap((element, index) =>
      element.elementNames.map((elementName) => ({
        sortText: index.toString(),
        label: elementName,
        kind: monaco.languages.CompletionItemKind.Class,
        detail: element.deprecated ? 'Deprecated' : '',
        insertText: this.getElementInputText(
          elementName,
          completionType,
          element
        ),
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: {
          value: this.turndownService.turndown(element.description ?? ''),
          isTrusted: true,
        },
      }))
    );
  };

  private getElementInputText = (
    name: string,
    completionType: CompletionType,
    element: Element
  ): string => {
    switch (completionType) {
      case CompletionType.element:
        return `${name}\${1}>\${2}</${name}`;
      case CompletionType.snippet:
        const mandatoryAttributes =
          this.frankDocParser.getMandatoryAttributes(element);
        let snippetIndex = 0;
        const mandatoryAttributeSnippet = mandatoryAttributes
          .map((attribute, index) => {
            snippetIndex = ++index;
            return ` ${attribute.name}="\${${snippetIndex}}"`;
          })
          .join('');
        return `<${name}${mandatoryAttributeSnippet}\${${++snippetIndex}}>\${${++snippetIndex}}</${name}>`;
      default:
        return name;
    }
  };

  private getAttributes = (
    element: Element,
    completionType: CompletionType,
    wordsUntilPosition: string
  ): ICompletion[] => {
    if (!element) return [];
    const usedAttributes = this.getAttributesFromText(wordsUntilPosition);
    const attributes = this.frankDocParser
      .removeDuplicateAttributes(this.frankDocParser.getAttributes(element))
      .filter((attribute) => !usedAttributes.includes(attribute.name));
    return attributes.map((attribute, index) => ({
      sortText: index.toString(),
      label: attribute.name,
      kind: monaco.languages.CompletionItemKind.Field,
      detail: attribute.deprecated ? 'Deprecated' : '',
      insertText: this.getAttributeInputText(attribute.name, completionType),
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: {
        value: this.turndownService.turndown(attribute.description ?? ''),
        isTrusted: true,
      },
    }));
  };

  private getAttributeInputText = (
    name: string,
    completionType: CompletionType
  ): string => {
    switch (completionType) {
      case CompletionType.attribute:
        return `${name}="\${1}"`;
      default:
        return name;
    }
  };

  private getAttributeValues = (
    element: Element,
    wordsUntilPosition: string
  ): ICompletion[] => {
    const attributes = this.getAttributesFromText(wordsUntilPosition);
    const attributeName = attributes[attributes.length - 1];
    const attribute = this.frankDocParser.getAttribute(element, attributeName);
    if (attribute.type == 'bool') {
      return ['true', 'false'].map((value) => ({
        label: value,
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: value,
      }));
    }
    if (!attribute.enum) return [];
    const attributeEnum = this.frankDocParser.getEnumFromAttribute(attribute);
    return attributeEnum.values.map((value, index) => ({
      sortText: index.toString(),
      label: value.label,
      kind: monaco.languages.CompletionItemKind.Value,
      detail: value.deprecated ? 'Deprecated' : '',
      insertText: value.label,
      documentation: this.turndownService.turndown(value.description ?? ''),
    }));
  };

  private getLastTagBeforePosition = (
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): string | undefined => {
    const wordsBeforePosition = this.getWordsBeforePosition(model, position);
    const tagsBeforePosition = this.getTagsFromText(wordsBeforePosition);
    if (tagsBeforePosition && tagsBeforePosition.length > 0)
      return tagsBeforePosition[tagsBeforePosition.length - 1];
    return;
  };

  private getWordsBeforePosition = (
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): string =>
    model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 0,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

  private getClosingElementCompletion = (element: string): ICompletion[] => [
    {
      label: element,
      kind: monaco.languages.CompletionItemKind.Property,
      detail: 'Close tag',
      insertText: element,
      documentation: `Closes the unclosed ${element} tag in this file.`,
    },
  ];

  private getStartColumnForTagWithNamespace = (
    wordUntilPosition: monaco.editor.IWordAtPosition,
    tagBeforePosition: string | undefined
  ) => {
    if (
      wordUntilPosition &&
      tagBeforePosition &&
      wordUntilPosition.word === this.getTagName(tagBeforePosition)
    ) {
      const lengthDifferance = Math.abs(
        tagBeforePosition.length - wordUntilPosition.word.length
      );
      return wordUntilPosition.startColumn - lengthDifferance;
    }
    return wordUntilPosition.startColumn;
  };
}
