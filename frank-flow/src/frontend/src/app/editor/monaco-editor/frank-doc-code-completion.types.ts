/**
 * A completion item represents a text snippet that is
 * proposed to complete text that is being typed.
 */
export interface ICompletion {
  /**
   * The label of this completion item. By default
   * this is also the text that is inserted when selecting
   * this completion.
   */
  label: string | monaco.languages.CompletionItemLabel;
  /**
   * The kind of this completion item. Based on the kind
   * an icon is chosen by the editor.
   */
  kind: monaco.languages.CompletionItemKind;
  /**
   * A modifier to the `kind` which affect how the item
   * is rendered, e.g. Deprecated is rendered with a strikeout
   */
  tags?: ReadonlyArray<monaco.languages.CompletionItemTag>;
  /**
   * A human-readable string with additional information
   * about this item, like type or symbol information.
   */
  detail?: string;
  /**
   * A human-readable string that represents a doc-comment.
   */
  documentation?: string | monaco.IMarkdownString;
  /**
   * A string that should be used when comparing this item
   * with other items. When `falsy` the [label](#CompletionItem.label)
   * is used.
   */
  sortText?: string;
  /**
   * A string that should be used when filtering a set of
   * completion items. When `falsy` the [label](#CompletionItem.label)
   * is used.
   */
  filterText?: string;
  /**
   * Select this item when showing. *Note* that only one completion item can be selected and
   * that the editor decides which item that is. The rule is that the *first* item of those
   * that match best is selected.
   */
  preselect?: boolean;
  /**
   * A string or snippet that should be inserted in a document when selecting
   * this completion.
   * is used.
   */
  insertText: string;
  /**
   * Addition rules (as bitmask) that should be applied when inserting
   * this completion.
   */
  insertTextRules?: monaco.languages.CompletionItemInsertTextRule;
  /**
   * A range of text that should be replaced by this completion item.
   *
   * Defaults to a range from the start of the [current word](#TextDocument.getWordRangeAtPosition) to the
   * current position.
   *
   * *Note:* The range must be a [single line](#Range.isSingleLine) and it must
   * [contain](#Range.contains) the position at which completion has been [requested](#CompletionItemProvider.provideCompletionItems).
   */
  range?:
    | monaco.IRange
    | {
        insert: monaco.IRange;
        replace: monaco.IRange;
      };
  /**
   * An optional set of characters that when pressed while this completion is active will accept it first and
   * then type that character. *Note* that all commit characters should have `length=1` and that superfluous
   * characters will be ignored.
   */
  commitCharacters?: string[];
  /**
   * An optional array of additional text edits that are applied when
   * selecting this completion. Edits must not overlap with the main edit
   * nor with themselves.
   */
  additionalTextEdits?: monaco.editor.ISingleEditOperation[];
  /**
   * A command that should be run upon acceptance of this item.
   */
  command?: monaco.languages.Command;
}

export enum CompletionType {
  none,
  element,
  attribute,
  incompleteElement,
  closingElement,
  snippet,
  incompleteAttribute,
  attributeValue,
}
