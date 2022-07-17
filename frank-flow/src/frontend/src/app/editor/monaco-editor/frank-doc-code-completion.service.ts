import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FrankDocCodeCompletionService {
  constructor() {}

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
}
