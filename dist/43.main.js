(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[43],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/razor/razor.js":
/*!**************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/razor/razor.js ***!
  \**************************************************************************/
/*! exports provided: conf, language */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "conf", function() { return conf; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "language", function() { return language; });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Allow for running under nodejs/requirejs in tests
var _monaco = (typeof monaco === 'undefined' ? self.monaco : monaco);
var EMPTY_ELEMENTS = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr'];
var conf = {
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
    comments: {
        blockComment: ['<!--', '-->']
    },
    brackets: [
        ['<!--', '-->'],
        ['<', '>'],
        ['{', '}'],
        ['(', ')']
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' }
    ],
    surroundingPairs: [
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: '<', close: '>' }
    ],
    onEnterRules: [
        {
            beforeText: new RegExp("<(?!(?:" + EMPTY_ELEMENTS.join('|') + "))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$", 'i'),
            afterText: /^<\/(\w[\w\d]*)\s*>$/i,
            action: { indentAction: _monaco.languages.IndentAction.IndentOutdent }
        },
        {
            beforeText: new RegExp("<(?!(?:" + EMPTY_ELEMENTS.join('|') + "))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$", 'i'),
            action: { indentAction: _monaco.languages.IndentAction.Indent }
        }
    ],
};
var language = {
    defaultToken: '',
    tokenPostfix: '',
    // ignoreCase: true,
    // The main tokenizer for our languages
    tokenizer: {
        root: [
            [/@@/],
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.root' }],
            [/<!DOCTYPE/, 'metatag.html', '@doctype'],
            [/<!--/, 'comment.html', '@comment'],
            [/(<)(\w+)(\/>)/, ['delimiter.html', 'tag.html', 'delimiter.html']],
            [/(<)(script)/, ['delimiter.html', { token: 'tag.html', next: '@script' }]],
            [/(<)(style)/, ['delimiter.html', { token: 'tag.html', next: '@style' }]],
            [/(<)([:\w]+)/, ['delimiter.html', { token: 'tag.html', next: '@otherTag' }]],
            [/(<\/)(\w+)/, ['delimiter.html', { token: 'tag.html', next: '@otherTag' }]],
            [/</, 'delimiter.html'],
            [/[ \t\r\n]+/],
            [/[^<@]+/],
        ],
        doctype: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.comment' }],
            [/[^>]+/, 'metatag.content.html'],
            [/>/, 'metatag.html', '@pop'],
        ],
        comment: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.comment' }],
            [/-->/, 'comment.html', '@pop'],
            [/[^-]+/, 'comment.content.html'],
            [/./, 'comment.content.html']
        ],
        otherTag: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.otherTag' }],
            [/\/?>/, 'delimiter.html', '@pop'],
            [/"([^"]*)"/, 'attribute.value'],
            [/'([^']*)'/, 'attribute.value'],
            [/[\w\-]+/, 'attribute.name'],
            [/=/, 'delimiter'],
            [/[ \t\r\n]+/],
        ],
        // -- BEGIN <script> tags handling
        // After <script
        script: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.script' }],
            [/type/, 'attribute.name', '@scriptAfterType'],
            [/"([^"]*)"/, 'attribute.value'],
            [/'([^']*)'/, 'attribute.value'],
            [/[\w\-]+/, 'attribute.name'],
            [/=/, 'delimiter'],
            [/>/, { token: 'delimiter.html', next: '@scriptEmbedded.text/javascript', nextEmbedded: 'text/javascript' }],
            [/[ \t\r\n]+/],
            [/(<\/)(script\s*)(>)/, ['delimiter.html', 'tag.html', { token: 'delimiter.html', next: '@pop' }]]
        ],
        // After <script ... type
        scriptAfterType: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.scriptAfterType' }],
            [/=/, 'delimiter', '@scriptAfterTypeEquals'],
            [/>/, { token: 'delimiter.html', next: '@scriptEmbedded.text/javascript', nextEmbedded: 'text/javascript' }],
            [/[ \t\r\n]+/],
            [/<\/script\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        // After <script ... type =
        scriptAfterTypeEquals: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.scriptAfterTypeEquals' }],
            [/"([^"]*)"/, { token: 'attribute.value', switchTo: '@scriptWithCustomType.$1' }],
            [/'([^']*)'/, { token: 'attribute.value', switchTo: '@scriptWithCustomType.$1' }],
            [/>/, { token: 'delimiter.html', next: '@scriptEmbedded.text/javascript', nextEmbedded: 'text/javascript' }],
            [/[ \t\r\n]+/],
            [/<\/script\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        // After <script ... type = $S2
        scriptWithCustomType: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.scriptWithCustomType.$S2' }],
            [/>/, { token: 'delimiter.html', next: '@scriptEmbedded.$S2', nextEmbedded: '$S2' }],
            [/"([^"]*)"/, 'attribute.value'],
            [/'([^']*)'/, 'attribute.value'],
            [/[\w\-]+/, 'attribute.name'],
            [/=/, 'delimiter'],
            [/[ \t\r\n]+/],
            [/<\/script\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        scriptEmbedded: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInEmbeddedState.scriptEmbedded.$S2', nextEmbedded: '@pop' }],
            [/<\/script/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }]
        ],
        // -- END <script> tags handling
        // -- BEGIN <style> tags handling
        // After <style
        style: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.style' }],
            [/type/, 'attribute.name', '@styleAfterType'],
            [/"([^"]*)"/, 'attribute.value'],
            [/'([^']*)'/, 'attribute.value'],
            [/[\w\-]+/, 'attribute.name'],
            [/=/, 'delimiter'],
            [/>/, { token: 'delimiter.html', next: '@styleEmbedded.text/css', nextEmbedded: 'text/css' }],
            [/[ \t\r\n]+/],
            [/(<\/)(style\s*)(>)/, ['delimiter.html', 'tag.html', { token: 'delimiter.html', next: '@pop' }]]
        ],
        // After <style ... type
        styleAfterType: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.styleAfterType' }],
            [/=/, 'delimiter', '@styleAfterTypeEquals'],
            [/>/, { token: 'delimiter.html', next: '@styleEmbedded.text/css', nextEmbedded: 'text/css' }],
            [/[ \t\r\n]+/],
            [/<\/style\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        // After <style ... type =
        styleAfterTypeEquals: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.styleAfterTypeEquals' }],
            [/"([^"]*)"/, { token: 'attribute.value', switchTo: '@styleWithCustomType.$1' }],
            [/'([^']*)'/, { token: 'attribute.value', switchTo: '@styleWithCustomType.$1' }],
            [/>/, { token: 'delimiter.html', next: '@styleEmbedded.text/css', nextEmbedded: 'text/css' }],
            [/[ \t\r\n]+/],
            [/<\/style\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        // After <style ... type = $S2
        styleWithCustomType: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInSimpleState.styleWithCustomType.$S2' }],
            [/>/, { token: 'delimiter.html', next: '@styleEmbedded.$S2', nextEmbedded: '$S2' }],
            [/"([^"]*)"/, 'attribute.value'],
            [/'([^']*)'/, 'attribute.value'],
            [/[\w\-]+/, 'attribute.name'],
            [/=/, 'delimiter'],
            [/[ \t\r\n]+/],
            [/<\/style\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        styleEmbedded: [
            [/@[^@]/, { token: '@rematch', switchTo: '@razorInEmbeddedState.styleEmbedded.$S2', nextEmbedded: '@pop' }],
            [/<\/style/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }]
        ],
        // -- END <style> tags handling
        razorInSimpleState: [
            [/@\*/, 'comment.cs', '@razorBlockCommentTopLevel'],
            [/@[{(]/, 'metatag.cs', '@razorRootTopLevel'],
            [/(@)(\s*[\w]+)/, ['metatag.cs', { token: 'identifier.cs', switchTo: '@$S2.$S3' }]],
            [/[})]/, { token: 'metatag.cs', switchTo: '@$S2.$S3' }],
            [/\*@/, { token: 'comment.cs', switchTo: '@$S2.$S3' }],
        ],
        razorInEmbeddedState: [
            [/@\*/, 'comment.cs', '@razorBlockCommentTopLevel'],
            [/@[{(]/, 'metatag.cs', '@razorRootTopLevel'],
            [/(@)(\s*[\w]+)/, ['metatag.cs', { token: 'identifier.cs', switchTo: '@$S2.$S3', nextEmbedded: '$S3' }]],
            [/[})]/, { token: 'metatag.cs', switchTo: '@$S2.$S3', nextEmbedded: '$S3' }],
            [/\*@/, { token: 'comment.cs', switchTo: '@$S2.$S3', nextEmbedded: '$S3' }],
        ],
        razorBlockCommentTopLevel: [
            [/\*@/, '@rematch', '@pop'],
            [/[^*]+/, 'comment.cs'],
            [/./, 'comment.cs']
        ],
        razorBlockComment: [
            [/\*@/, 'comment.cs', '@pop'],
            [/[^*]+/, 'comment.cs'],
            [/./, 'comment.cs']
        ],
        razorRootTopLevel: [
            [/\{/, 'delimiter.bracket.cs', '@razorRoot'],
            [/\(/, 'delimiter.parenthesis.cs', '@razorRoot'],
            [/[})]/, '@rematch', '@pop'],
            { include: 'razorCommon' }
        ],
        razorRoot: [
            [/\{/, 'delimiter.bracket.cs', '@razorRoot'],
            [/\(/, 'delimiter.parenthesis.cs', '@razorRoot'],
            [/\}/, 'delimiter.bracket.cs', '@pop'],
            [/\)/, 'delimiter.parenthesis.cs', '@pop'],
            { include: 'razorCommon' }
        ],
        razorCommon: [
            [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@razorKeywords': { token: 'keyword.cs' },
                        '@default': 'identifier.cs'
                    }
                }],
            // brackets
            [/[\[\]]/, 'delimiter.array.cs'],
            // whitespace
            [/[ \t\r\n]+/],
            // comments
            [/\/\/.*$/, 'comment.cs'],
            [/@\*/, 'comment.cs', '@razorBlockComment'],
            // strings
            [/"([^"]*)"/, 'string.cs'],
            [/'([^']*)'/, 'string.cs'],
            // simple html
            [/(<)(\w+)(\/>)/, ['delimiter.html', 'tag.html', 'delimiter.html']],
            [/(<)(\w+)(>)/, ['delimiter.html', 'tag.html', 'delimiter.html']],
            [/(<\/)(\w+)(>)/, ['delimiter.html', 'tag.html', 'delimiter.html']],
            // delimiters
            [/[\+\-\*\%\&\|\^\~\!\=\<\>\/\?\;\:\.\,]/, 'delimiter.cs'],
            // numbers
            [/\d*\d+[eE]([\-+]?\d+)?/, 'number.float.cs'],
            [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float.cs'],
            [/0[xX][0-9a-fA-F']*[0-9a-fA-F]/, 'number.hex.cs'],
            [/0[0-7']*[0-7]/, 'number.octal.cs'],
            [/0[bB][0-1']*[0-1]/, 'number.binary.cs'],
            [/\d[\d']*/, 'number.cs'],
            [/\d/, 'number.cs'],
        ]
    },
    razorKeywords: [
        'abstract', 'as', 'async', 'await', 'base', 'bool',
        'break', 'by', 'byte', 'case',
        'catch', 'char', 'checked', 'class',
        'const', 'continue', 'decimal', 'default',
        'delegate', 'do', 'double', 'descending',
        'explicit', 'event', 'extern', 'else',
        'enum', 'false', 'finally', 'fixed',
        'float', 'for', 'foreach', 'from',
        'goto', 'group', 'if', 'implicit',
        'in', 'int', 'interface', 'internal',
        'into', 'is', 'lock', 'long', 'nameof',
        'new', 'null', 'namespace', 'object',
        'operator', 'out', 'override', 'orderby',
        'params', 'private', 'protected', 'public',
        'readonly', 'ref', 'return', 'switch',
        'struct', 'sbyte', 'sealed', 'short',
        'sizeof', 'stackalloc', 'static', 'string',
        'select', 'this', 'throw', 'true',
        'try', 'typeof', 'uint', 'ulong',
        'unchecked', 'unsafe', 'ushort', 'using',
        'var', 'virtual', 'volatile', 'void', 'when',
        'while', 'where', 'yield',
        'model', 'inject' // Razor specific
    ],
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3Jhem9yL3Jhem9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNhO0FBQ2I7QUFDQTtBQUNBO0FBQ087QUFDUCxrRUFBa0UsSUFBSSxNQUFNO0FBQzVFO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsV0FBVyxLQUFLO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBLFNBQVMsU0FBUyxZQUFZLEdBQUc7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUztBQUNUO0FBQ0E7QUFDQSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQjtBQUNyQixTQUFTO0FBQ1Q7QUFDQTtBQUNBLHFCQUFxQjtBQUNyQjtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLDBEQUEwRDtBQUNqRjtBQUNBO0FBQ0E7QUFDQSxnREFBZ0QscUNBQXFDO0FBQ3JGLCtDQUErQyxvQ0FBb0M7QUFDbkYsZ0RBQWdELHVDQUF1QztBQUN2RiwrQ0FBK0MsdUNBQXVDO0FBQ3RGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1QkFBdUIsNkRBQTZEO0FBQ3BGO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLDZEQUE2RDtBQUNwRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLDhEQUE4RDtBQUNyRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVCQUF1Qiw0REFBNEQ7QUFDbkY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQixvR0FBb0c7QUFDdkg7QUFDQSxvRUFBb0Usd0NBQXdDO0FBQzVHO0FBQ0E7QUFDQTtBQUNBLHVCQUF1QixxRUFBcUU7QUFDNUY7QUFDQSxtQkFBbUIsb0dBQW9HO0FBQ3ZIO0FBQ0EsK0JBQStCLGtDQUFrQztBQUNqRTtBQUNBO0FBQ0E7QUFDQSx1QkFBdUIsMkVBQTJFO0FBQ2xHLDJCQUEyQixpRUFBaUU7QUFDNUYsMkJBQTJCLGlFQUFpRTtBQUM1RixtQkFBbUIsb0dBQW9HO0FBQ3ZIO0FBQ0EsK0JBQStCLGtDQUFrQztBQUNqRTtBQUNBO0FBQ0E7QUFDQSx1QkFBdUIsOEVBQThFO0FBQ3JHLG1CQUFtQiw0RUFBNEU7QUFDL0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLCtCQUErQixrQ0FBa0M7QUFDakU7QUFDQTtBQUNBLHVCQUF1QixnR0FBZ0c7QUFDdkgsMkJBQTJCLHdEQUF3RDtBQUNuRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLDJEQUEyRDtBQUNsRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLHFGQUFxRjtBQUN4RztBQUNBLG1FQUFtRSx3Q0FBd0M7QUFDM0c7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLG9FQUFvRTtBQUMzRjtBQUNBLG1CQUFtQixxRkFBcUY7QUFDeEc7QUFDQSw4QkFBOEIsa0NBQWtDO0FBQ2hFO0FBQ0E7QUFDQTtBQUNBLHVCQUF1QiwwRUFBMEU7QUFDakcsMkJBQTJCLGdFQUFnRTtBQUMzRiwyQkFBMkIsZ0VBQWdFO0FBQzNGLG1CQUFtQixxRkFBcUY7QUFDeEc7QUFDQSw4QkFBOEIsa0NBQWtDO0FBQ2hFO0FBQ0E7QUFDQTtBQUNBLHVCQUF1Qiw2RUFBNkU7QUFDcEcsbUJBQW1CLDJFQUEyRTtBQUM5RjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsOEJBQThCLGtDQUFrQztBQUNoRTtBQUNBO0FBQ0EsdUJBQXVCLCtGQUErRjtBQUN0SCwwQkFBMEIsd0RBQXdEO0FBQ2xGO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCLDhDQUE4QywrQ0FBK0M7QUFDN0YsZ0JBQWdCLE1BQU0sNENBQTRDO0FBQ2xFLHFCQUFxQiw0Q0FBNEM7QUFDakU7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCLDhDQUE4QyxvRUFBb0U7QUFDbEgsZ0JBQWdCLE1BQU0saUVBQWlFO0FBQ3ZGLHFCQUFxQixpRUFBaUU7QUFDdEY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWdCO0FBQ2hCO0FBQ0EsZ0JBQWdCO0FBQ2hCLGFBQWE7QUFDYjtBQUNBO0FBQ0EsZ0JBQWdCO0FBQ2hCO0FBQ0EsZ0JBQWdCO0FBQ2hCO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMkNBQTJDLHNCQUFzQjtBQUNqRTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDZDQUE2QztBQUM3QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4Q0FBOEMsSUFBSSxjQUFjLEVBQUUsY0FBYyxFQUFFO0FBQ2xGIiwiZmlsZSI6IjQzLm1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG4vLyBBbGxvdyBmb3IgcnVubmluZyB1bmRlciBub2RlanMvcmVxdWlyZWpzIGluIHRlc3RzXHJcbnZhciBfbW9uYWNvID0gKHR5cGVvZiBtb25hY28gPT09ICd1bmRlZmluZWQnID8gc2VsZi5tb25hY28gOiBtb25hY28pO1xyXG52YXIgRU1QVFlfRUxFTUVOVFMgPSBbJ2FyZWEnLCAnYmFzZScsICdicicsICdjb2wnLCAnZW1iZWQnLCAnaHInLCAnaW1nJywgJ2lucHV0JywgJ2tleWdlbicsICdsaW5rJywgJ21lbnVpdGVtJywgJ21ldGEnLCAncGFyYW0nLCAnc291cmNlJywgJ3RyYWNrJywgJ3diciddO1xyXG5leHBvcnQgdmFyIGNvbmYgPSB7XHJcbiAgICB3b3JkUGF0dGVybjogLygtP1xcZCpcXC5cXGRcXHcqKXwoW15cXGBcXH5cXCFcXEBcXCRcXF5cXCZcXCpcXChcXClcXC1cXD1cXCtcXFtcXHtcXF1cXH1cXFxcXFx8XFw7XFw6XFwnXFxcIlxcLFxcLlxcPFxcPlxcL1xcc10rKS9nLFxyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBibG9ja0NvbW1lbnQ6IFsnPCEtLScsICctLT4nXVxyXG4gICAgfSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgWyc8IS0tJywgJy0tPiddLFxyXG4gICAgICAgIFsnPCcsICc+J10sXHJcbiAgICAgICAgWyd7JywgJ30nXSxcclxuICAgICAgICBbJygnLCAnKSddXHJcbiAgICBdLFxyXG4gICAgYXV0b0Nsb3NpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfVxyXG4gICAgXSxcclxuICAgIHN1cnJvdW5kaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnPCcsIGNsb3NlOiAnPicgfVxyXG4gICAgXSxcclxuICAgIG9uRW50ZXJSdWxlczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgYmVmb3JlVGV4dDogbmV3IFJlZ0V4cChcIjwoPyEoPzpcIiArIEVNUFRZX0VMRU1FTlRTLmpvaW4oJ3wnKSArIFwiKSkoXFxcXHdbXFxcXHdcXFxcZF0qKShbXi8+XSooPyEvKT4pW148XSokXCIsICdpJyksXHJcbiAgICAgICAgICAgIGFmdGVyVGV4dDogL148XFwvKFxcd1tcXHdcXGRdKilcXHMqPiQvaSxcclxuICAgICAgICAgICAgYWN0aW9uOiB7IGluZGVudEFjdGlvbjogX21vbmFjby5sYW5ndWFnZXMuSW5kZW50QWN0aW9uLkluZGVudE91dGRlbnQgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBiZWZvcmVUZXh0OiBuZXcgUmVnRXhwKFwiPCg/ISg/OlwiICsgRU1QVFlfRUxFTUVOVFMuam9pbignfCcpICsgXCIpKShcXFxcd1tcXFxcd1xcXFxkXSopKFteLz5dKig/IS8pPilbXjxdKiRcIiwgJ2knKSxcclxuICAgICAgICAgICAgYWN0aW9uOiB7IGluZGVudEFjdGlvbjogX21vbmFjby5sYW5ndWFnZXMuSW5kZW50QWN0aW9uLkluZGVudCB9XHJcbiAgICAgICAgfVxyXG4gICAgXSxcclxufTtcclxuZXhwb3J0IHZhciBsYW5ndWFnZSA9IHtcclxuICAgIGRlZmF1bHRUb2tlbjogJycsXHJcbiAgICB0b2tlblBvc3RmaXg6ICcnLFxyXG4gICAgLy8gaWdub3JlQ2FzZTogdHJ1ZSxcclxuICAgIC8vIFRoZSBtYWluIHRva2VuaXplciBmb3Igb3VyIGxhbmd1YWdlc1xyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICBbL0BAL10sXHJcbiAgICAgICAgICAgIFsvQFteQF0vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBzd2l0Y2hUbzogJ0ByYXpvckluU2ltcGxlU3RhdGUucm9vdCcgfV0sXHJcbiAgICAgICAgICAgIFsvPCFET0NUWVBFLywgJ21ldGF0YWcuaHRtbCcsICdAZG9jdHlwZSddLFxyXG4gICAgICAgICAgICBbLzwhLS0vLCAnY29tbWVudC5odG1sJywgJ0Bjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvKDwpKFxcdyspKFxcLz4pLywgWydkZWxpbWl0ZXIuaHRtbCcsICd0YWcuaHRtbCcsICdkZWxpbWl0ZXIuaHRtbCddXSxcclxuICAgICAgICAgICAgWy8oPCkoc2NyaXB0KS8sIFsnZGVsaW1pdGVyLmh0bWwnLCB7IHRva2VuOiAndGFnLmh0bWwnLCBuZXh0OiAnQHNjcmlwdCcgfV1dLFxyXG4gICAgICAgICAgICBbLyg8KShzdHlsZSkvLCBbJ2RlbGltaXRlci5odG1sJywgeyB0b2tlbjogJ3RhZy5odG1sJywgbmV4dDogJ0BzdHlsZScgfV1dLFxyXG4gICAgICAgICAgICBbLyg8KShbOlxcd10rKS8sIFsnZGVsaW1pdGVyLmh0bWwnLCB7IHRva2VuOiAndGFnLmh0bWwnLCBuZXh0OiAnQG90aGVyVGFnJyB9XV0sXHJcbiAgICAgICAgICAgIFsvKDxcXC8pKFxcdyspLywgWydkZWxpbWl0ZXIuaHRtbCcsIHsgdG9rZW46ICd0YWcuaHRtbCcsIG5leHQ6ICdAb3RoZXJUYWcnIH1dXSxcclxuICAgICAgICAgICAgWy88LywgJ2RlbGltaXRlci5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy9dLFxyXG4gICAgICAgICAgICBbL1tePEBdKy9dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgZG9jdHlwZTogW1xyXG4gICAgICAgICAgICBbL0BbXkBdLywgeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAcmF6b3JJblNpbXBsZVN0YXRlLmNvbW1lbnQnIH1dLFxyXG4gICAgICAgICAgICBbL1tePl0rLywgJ21ldGF0YWcuY29udGVudC5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvPi8sICdtZXRhdGFnLmh0bWwnLCAnQHBvcCddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29tbWVudDogW1xyXG4gICAgICAgICAgICBbL0BbXkBdLywgeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAcmF6b3JJblNpbXBsZVN0YXRlLmNvbW1lbnQnIH1dLFxyXG4gICAgICAgICAgICBbLy0tPi8sICdjb21tZW50Lmh0bWwnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbL1teLV0rLywgJ2NvbW1lbnQuY29udGVudC5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvLi8sICdjb21tZW50LmNvbnRlbnQuaHRtbCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBvdGhlclRhZzogW1xyXG4gICAgICAgICAgICBbL0BbXkBdLywgeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAcmF6b3JJblNpbXBsZVN0YXRlLm90aGVyVGFnJyB9XSxcclxuICAgICAgICAgICAgWy9cXC8/Pi8sICdkZWxpbWl0ZXIuaHRtbCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvXCIoW15cIl0qKVwiLywgJ2F0dHJpYnV0ZS52YWx1ZSddLFxyXG4gICAgICAgICAgICBbLycoW14nXSopJy8sICdhdHRyaWJ1dGUudmFsdWUnXSxcclxuICAgICAgICAgICAgWy9bXFx3XFwtXSsvLCAnYXR0cmlidXRlLm5hbWUnXSxcclxuICAgICAgICAgICAgWy89LywgJ2RlbGltaXRlciddLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIC0tIEJFR0lOIDxzY3JpcHQ+IHRhZ3MgaGFuZGxpbmdcclxuICAgICAgICAvLyBBZnRlciA8c2NyaXB0XHJcbiAgICAgICAgc2NyaXB0OiBbXHJcbiAgICAgICAgICAgIFsvQFteQF0vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBzd2l0Y2hUbzogJ0ByYXpvckluU2ltcGxlU3RhdGUuc2NyaXB0JyB9XSxcclxuICAgICAgICAgICAgWy90eXBlLywgJ2F0dHJpYnV0ZS5uYW1lJywgJ0BzY3JpcHRBZnRlclR5cGUnXSxcclxuICAgICAgICAgICAgWy9cIihbXlwiXSopXCIvLCAnYXR0cmlidXRlLnZhbHVlJ10sXHJcbiAgICAgICAgICAgIFsvJyhbXiddKiknLywgJ2F0dHJpYnV0ZS52YWx1ZSddLFxyXG4gICAgICAgICAgICBbL1tcXHdcXC1dKy8sICdhdHRyaWJ1dGUubmFtZSddLFxyXG4gICAgICAgICAgICBbLz0vLCAnZGVsaW1pdGVyJ10sXHJcbiAgICAgICAgICAgIFsvPi8sIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAc2NyaXB0RW1iZWRkZWQudGV4dC9qYXZhc2NyaXB0JywgbmV4dEVtYmVkZGVkOiAndGV4dC9qYXZhc2NyaXB0JyB9XSxcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rL10sXHJcbiAgICAgICAgICAgIFsvKDxcXC8pKHNjcmlwdFxccyopKD4pLywgWydkZWxpbWl0ZXIuaHRtbCcsICd0YWcuaHRtbCcsIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAcG9wJyB9XV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEFmdGVyIDxzY3JpcHQgLi4uIHR5cGVcclxuICAgICAgICBzY3JpcHRBZnRlclR5cGU6IFtcclxuICAgICAgICAgICAgWy9AW15AXS8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIHN3aXRjaFRvOiAnQHJhem9ySW5TaW1wbGVTdGF0ZS5zY3JpcHRBZnRlclR5cGUnIH1dLFxyXG4gICAgICAgICAgICBbLz0vLCAnZGVsaW1pdGVyJywgJ0BzY3JpcHRBZnRlclR5cGVFcXVhbHMnXSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzY3JpcHRFbWJlZGRlZC50ZXh0L2phdmFzY3JpcHQnLCBuZXh0RW1iZWRkZWQ6ICd0ZXh0L2phdmFzY3JpcHQnIH1dLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICAgICAgWy88XFwvc2NyaXB0XFxzKj4vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEFmdGVyIDxzY3JpcHQgLi4uIHR5cGUgPVxyXG4gICAgICAgIHNjcmlwdEFmdGVyVHlwZUVxdWFsczogW1xyXG4gICAgICAgICAgICBbL0BbXkBdLywgeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAcmF6b3JJblNpbXBsZVN0YXRlLnNjcmlwdEFmdGVyVHlwZUVxdWFscycgfV0sXHJcbiAgICAgICAgICAgIFsvXCIoW15cIl0qKVwiLywgeyB0b2tlbjogJ2F0dHJpYnV0ZS52YWx1ZScsIHN3aXRjaFRvOiAnQHNjcmlwdFdpdGhDdXN0b21UeXBlLiQxJyB9XSxcclxuICAgICAgICAgICAgWy8nKFteJ10qKScvLCB7IHRva2VuOiAnYXR0cmlidXRlLnZhbHVlJywgc3dpdGNoVG86ICdAc2NyaXB0V2l0aEN1c3RvbVR5cGUuJDEnIH1dLFxyXG4gICAgICAgICAgICBbLz4vLCB7IHRva2VuOiAnZGVsaW1pdGVyLmh0bWwnLCBuZXh0OiAnQHNjcmlwdEVtYmVkZGVkLnRleHQvamF2YXNjcmlwdCcsIG5leHRFbWJlZGRlZDogJ3RleHQvamF2YXNjcmlwdCcgfV0sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy9dLFxyXG4gICAgICAgICAgICBbLzxcXC9zY3JpcHRcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gQWZ0ZXIgPHNjcmlwdCAuLi4gdHlwZSA9ICRTMlxyXG4gICAgICAgIHNjcmlwdFdpdGhDdXN0b21UeXBlOiBbXHJcbiAgICAgICAgICAgIFsvQFteQF0vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBzd2l0Y2hUbzogJ0ByYXpvckluU2ltcGxlU3RhdGUuc2NyaXB0V2l0aEN1c3RvbVR5cGUuJFMyJyB9XSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzY3JpcHRFbWJlZGRlZC4kUzInLCBuZXh0RW1iZWRkZWQ6ICckUzInIH1dLFxyXG4gICAgICAgICAgICBbL1wiKFteXCJdKilcIi8sICdhdHRyaWJ1dGUudmFsdWUnXSxcclxuICAgICAgICAgICAgWy8nKFteJ10qKScvLCAnYXR0cmlidXRlLnZhbHVlJ10sXHJcbiAgICAgICAgICAgIFsvW1xcd1xcLV0rLywgJ2F0dHJpYnV0ZS5uYW1lJ10sXHJcbiAgICAgICAgICAgIFsvPS8sICdkZWxpbWl0ZXInXSxcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rL10sXHJcbiAgICAgICAgICAgIFsvPFxcL3NjcmlwdFxccyo+LywgeyB0b2tlbjogJ0ByZW1hdGNoJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzY3JpcHRFbWJlZGRlZDogW1xyXG4gICAgICAgICAgICBbL0BbXkBdLywgeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAcmF6b3JJbkVtYmVkZGVkU3RhdGUuc2NyaXB0RW1iZWRkZWQuJFMyJywgbmV4dEVtYmVkZGVkOiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIFsvPFxcL3NjcmlwdC8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJywgbmV4dEVtYmVkZGVkOiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIC0tIEVORCA8c2NyaXB0PiB0YWdzIGhhbmRsaW5nXHJcbiAgICAgICAgLy8gLS0gQkVHSU4gPHN0eWxlPiB0YWdzIGhhbmRsaW5nXHJcbiAgICAgICAgLy8gQWZ0ZXIgPHN0eWxlXHJcbiAgICAgICAgc3R5bGU6IFtcclxuICAgICAgICAgICAgWy9AW15AXS8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIHN3aXRjaFRvOiAnQHJhem9ySW5TaW1wbGVTdGF0ZS5zdHlsZScgfV0sXHJcbiAgICAgICAgICAgIFsvdHlwZS8sICdhdHRyaWJ1dGUubmFtZScsICdAc3R5bGVBZnRlclR5cGUnXSxcclxuICAgICAgICAgICAgWy9cIihbXlwiXSopXCIvLCAnYXR0cmlidXRlLnZhbHVlJ10sXHJcbiAgICAgICAgICAgIFsvJyhbXiddKiknLywgJ2F0dHJpYnV0ZS52YWx1ZSddLFxyXG4gICAgICAgICAgICBbL1tcXHdcXC1dKy8sICdhdHRyaWJ1dGUubmFtZSddLFxyXG4gICAgICAgICAgICBbLz0vLCAnZGVsaW1pdGVyJ10sXHJcbiAgICAgICAgICAgIFsvPi8sIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAc3R5bGVFbWJlZGRlZC50ZXh0L2NzcycsIG5leHRFbWJlZGRlZDogJ3RleHQvY3NzJyB9XSxcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rL10sXHJcbiAgICAgICAgICAgIFsvKDxcXC8pKHN0eWxlXFxzKikoPikvLCBbJ2RlbGltaXRlci5odG1sJywgJ3RhZy5odG1sJywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0Bwb3AnIH1dXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gQWZ0ZXIgPHN0eWxlIC4uLiB0eXBlXHJcbiAgICAgICAgc3R5bGVBZnRlclR5cGU6IFtcclxuICAgICAgICAgICAgWy9AW15AXS8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIHN3aXRjaFRvOiAnQHJhem9ySW5TaW1wbGVTdGF0ZS5zdHlsZUFmdGVyVHlwZScgfV0sXHJcbiAgICAgICAgICAgIFsvPS8sICdkZWxpbWl0ZXInLCAnQHN0eWxlQWZ0ZXJUeXBlRXF1YWxzJ10sXHJcbiAgICAgICAgICAgIFsvPi8sIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAc3R5bGVFbWJlZGRlZC50ZXh0L2NzcycsIG5leHRFbWJlZGRlZDogJ3RleHQvY3NzJyB9XSxcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rL10sXHJcbiAgICAgICAgICAgIFsvPFxcL3N0eWxlXFxzKj4vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEFmdGVyIDxzdHlsZSAuLi4gdHlwZSA9XHJcbiAgICAgICAgc3R5bGVBZnRlclR5cGVFcXVhbHM6IFtcclxuICAgICAgICAgICAgWy9AW15AXS8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIHN3aXRjaFRvOiAnQHJhem9ySW5TaW1wbGVTdGF0ZS5zdHlsZUFmdGVyVHlwZUVxdWFscycgfV0sXHJcbiAgICAgICAgICAgIFsvXCIoW15cIl0qKVwiLywgeyB0b2tlbjogJ2F0dHJpYnV0ZS52YWx1ZScsIHN3aXRjaFRvOiAnQHN0eWxlV2l0aEN1c3RvbVR5cGUuJDEnIH1dLFxyXG4gICAgICAgICAgICBbLycoW14nXSopJy8sIHsgdG9rZW46ICdhdHRyaWJ1dGUudmFsdWUnLCBzd2l0Y2hUbzogJ0BzdHlsZVdpdGhDdXN0b21UeXBlLiQxJyB9XSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzdHlsZUVtYmVkZGVkLnRleHQvY3NzJywgbmV4dEVtYmVkZGVkOiAndGV4dC9jc3MnIH1dLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICAgICAgWy88XFwvc3R5bGVcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gQWZ0ZXIgPHN0eWxlIC4uLiB0eXBlID0gJFMyXHJcbiAgICAgICAgc3R5bGVXaXRoQ3VzdG9tVHlwZTogW1xyXG4gICAgICAgICAgICBbL0BbXkBdLywgeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAcmF6b3JJblNpbXBsZVN0YXRlLnN0eWxlV2l0aEN1c3RvbVR5cGUuJFMyJyB9XSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzdHlsZUVtYmVkZGVkLiRTMicsIG5leHRFbWJlZGRlZDogJyRTMicgfV0sXHJcbiAgICAgICAgICAgIFsvXCIoW15cIl0qKVwiLywgJ2F0dHJpYnV0ZS52YWx1ZSddLFxyXG4gICAgICAgICAgICBbLycoW14nXSopJy8sICdhdHRyaWJ1dGUudmFsdWUnXSxcclxuICAgICAgICAgICAgWy9bXFx3XFwtXSsvLCAnYXR0cmlidXRlLm5hbWUnXSxcclxuICAgICAgICAgICAgWy89LywgJ2RlbGltaXRlciddLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICAgICAgWy88XFwvc3R5bGVcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3R5bGVFbWJlZGRlZDogW1xyXG4gICAgICAgICAgICBbL0BbXkBdLywgeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAcmF6b3JJbkVtYmVkZGVkU3RhdGUuc3R5bGVFbWJlZGRlZC4kUzInLCBuZXh0RW1iZWRkZWQ6ICdAcG9wJyB9XSxcclxuICAgICAgICAgICAgWy88XFwvc3R5bGUvLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcsIG5leHRFbWJlZGRlZDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyAtLSBFTkQgPHN0eWxlPiB0YWdzIGhhbmRsaW5nXHJcbiAgICAgICAgcmF6b3JJblNpbXBsZVN0YXRlOiBbXHJcbiAgICAgICAgICAgIFsvQFxcKi8sICdjb21tZW50LmNzJywgJ0ByYXpvckJsb2NrQ29tbWVudFRvcExldmVsJ10sXHJcbiAgICAgICAgICAgIFsvQFt7KF0vLCAnbWV0YXRhZy5jcycsICdAcmF6b3JSb290VG9wTGV2ZWwnXSxcclxuICAgICAgICAgICAgWy8oQCkoXFxzKltcXHddKykvLCBbJ21ldGF0YWcuY3MnLCB7IHRva2VuOiAnaWRlbnRpZmllci5jcycsIHN3aXRjaFRvOiAnQCRTMi4kUzMnIH1dXSxcclxuICAgICAgICAgICAgWy9bfSldLywgeyB0b2tlbjogJ21ldGF0YWcuY3MnLCBzd2l0Y2hUbzogJ0AkUzIuJFMzJyB9XSxcclxuICAgICAgICAgICAgWy9cXCpALywgeyB0b2tlbjogJ2NvbW1lbnQuY3MnLCBzd2l0Y2hUbzogJ0AkUzIuJFMzJyB9XSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJhem9ySW5FbWJlZGRlZFN0YXRlOiBbXHJcbiAgICAgICAgICAgIFsvQFxcKi8sICdjb21tZW50LmNzJywgJ0ByYXpvckJsb2NrQ29tbWVudFRvcExldmVsJ10sXHJcbiAgICAgICAgICAgIFsvQFt7KF0vLCAnbWV0YXRhZy5jcycsICdAcmF6b3JSb290VG9wTGV2ZWwnXSxcclxuICAgICAgICAgICAgWy8oQCkoXFxzKltcXHddKykvLCBbJ21ldGF0YWcuY3MnLCB7IHRva2VuOiAnaWRlbnRpZmllci5jcycsIHN3aXRjaFRvOiAnQCRTMi4kUzMnLCBuZXh0RW1iZWRkZWQ6ICckUzMnIH1dXSxcclxuICAgICAgICAgICAgWy9bfSldLywgeyB0b2tlbjogJ21ldGF0YWcuY3MnLCBzd2l0Y2hUbzogJ0AkUzIuJFMzJywgbmV4dEVtYmVkZGVkOiAnJFMzJyB9XSxcclxuICAgICAgICAgICAgWy9cXCpALywgeyB0b2tlbjogJ2NvbW1lbnQuY3MnLCBzd2l0Y2hUbzogJ0AkUzIuJFMzJywgbmV4dEVtYmVkZGVkOiAnJFMzJyB9XSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJhem9yQmxvY2tDb21tZW50VG9wTGV2ZWw6IFtcclxuICAgICAgICAgICAgWy9cXCpALywgJ0ByZW1hdGNoJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9bXipdKy8sICdjb21tZW50LmNzJ10sXHJcbiAgICAgICAgICAgIFsvLi8sICdjb21tZW50LmNzJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIHJhem9yQmxvY2tDb21tZW50OiBbXHJcbiAgICAgICAgICAgIFsvXFwqQC8sICdjb21tZW50LmNzJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9bXipdKy8sICdjb21tZW50LmNzJ10sXHJcbiAgICAgICAgICAgIFsvLi8sICdjb21tZW50LmNzJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIHJhem9yUm9vdFRvcExldmVsOiBbXHJcbiAgICAgICAgICAgIFsvXFx7LywgJ2RlbGltaXRlci5icmFja2V0LmNzJywgJ0ByYXpvclJvb3QnXSxcclxuICAgICAgICAgICAgWy9cXCgvLCAnZGVsaW1pdGVyLnBhcmVudGhlc2lzLmNzJywgJ0ByYXpvclJvb3QnXSxcclxuICAgICAgICAgICAgWy9bfSldLywgJ0ByZW1hdGNoJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAncmF6b3JDb21tb24nIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIHJhem9yUm9vdDogW1xyXG4gICAgICAgICAgICBbL1xcey8sICdkZWxpbWl0ZXIuYnJhY2tldC5jcycsICdAcmF6b3JSb290J10sXHJcbiAgICAgICAgICAgIFsvXFwoLywgJ2RlbGltaXRlci5wYXJlbnRoZXNpcy5jcycsICdAcmF6b3JSb290J10sXHJcbiAgICAgICAgICAgIFsvXFx9LywgJ2RlbGltaXRlci5icmFja2V0LmNzJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9cXCkvLCAnZGVsaW1pdGVyLnBhcmVudGhlc2lzLmNzJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAncmF6b3JDb21tb24nIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIHJhem9yQ29tbW9uOiBbXHJcbiAgICAgICAgICAgIFsvW2EtekEtWl9dXFx3Ki8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHJhem9yS2V5d29yZHMnOiB7IHRva2VuOiAna2V5d29yZC5jcycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ2lkZW50aWZpZXIuY3MnXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgIC8vIGJyYWNrZXRzXHJcbiAgICAgICAgICAgIFsvW1xcW1xcXV0vLCAnZGVsaW1pdGVyLmFycmF5LmNzJ10sXHJcbiAgICAgICAgICAgIC8vIHdoaXRlc3BhY2VcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rL10sXHJcbiAgICAgICAgICAgIC8vIGNvbW1lbnRzXHJcbiAgICAgICAgICAgIFsvXFwvXFwvLiokLywgJ2NvbW1lbnQuY3MnXSxcclxuICAgICAgICAgICAgWy9AXFwqLywgJ2NvbW1lbnQuY3MnLCAnQHJhem9yQmxvY2tDb21tZW50J10sXHJcbiAgICAgICAgICAgIC8vIHN0cmluZ3NcclxuICAgICAgICAgICAgWy9cIihbXlwiXSopXCIvLCAnc3RyaW5nLmNzJ10sXHJcbiAgICAgICAgICAgIFsvJyhbXiddKiknLywgJ3N0cmluZy5jcyddLFxyXG4gICAgICAgICAgICAvLyBzaW1wbGUgaHRtbFxyXG4gICAgICAgICAgICBbLyg8KShcXHcrKShcXC8+KS8sIFsnZGVsaW1pdGVyLmh0bWwnLCAndGFnLmh0bWwnLCAnZGVsaW1pdGVyLmh0bWwnXV0sXHJcbiAgICAgICAgICAgIFsvKDwpKFxcdyspKD4pLywgWydkZWxpbWl0ZXIuaHRtbCcsICd0YWcuaHRtbCcsICdkZWxpbWl0ZXIuaHRtbCddXSxcclxuICAgICAgICAgICAgWy8oPFxcLykoXFx3KykoPikvLCBbJ2RlbGltaXRlci5odG1sJywgJ3RhZy5odG1sJywgJ2RlbGltaXRlci5odG1sJ11dLFxyXG4gICAgICAgICAgICAvLyBkZWxpbWl0ZXJzXHJcbiAgICAgICAgICAgIFsvW1xcK1xcLVxcKlxcJVxcJlxcfFxcXlxcflxcIVxcPVxcPFxcPlxcL1xcP1xcO1xcOlxcLlxcLF0vLCAnZGVsaW1pdGVyLmNzJ10sXHJcbiAgICAgICAgICAgIC8vIG51bWJlcnNcclxuICAgICAgICAgICAgWy9cXGQqXFxkK1tlRV0oW1xcLStdP1xcZCspPy8sICdudW1iZXIuZmxvYXQuY3MnXSxcclxuICAgICAgICAgICAgWy9cXGQqXFwuXFxkKyhbZUVdW1xcLStdP1xcZCspPy8sICdudW1iZXIuZmxvYXQuY3MnXSxcclxuICAgICAgICAgICAgWy8wW3hYXVswLTlhLWZBLUYnXSpbMC05YS1mQS1GXS8sICdudW1iZXIuaGV4LmNzJ10sXHJcbiAgICAgICAgICAgIFsvMFswLTcnXSpbMC03XS8sICdudW1iZXIub2N0YWwuY3MnXSxcclxuICAgICAgICAgICAgWy8wW2JCXVswLTEnXSpbMC0xXS8sICdudW1iZXIuYmluYXJ5LmNzJ10sXHJcbiAgICAgICAgICAgIFsvXFxkW1xcZCddKi8sICdudW1iZXIuY3MnXSxcclxuICAgICAgICAgICAgWy9cXGQvLCAnbnVtYmVyLmNzJ10sXHJcbiAgICAgICAgXVxyXG4gICAgfSxcclxuICAgIHJhem9yS2V5d29yZHM6IFtcclxuICAgICAgICAnYWJzdHJhY3QnLCAnYXMnLCAnYXN5bmMnLCAnYXdhaXQnLCAnYmFzZScsICdib29sJyxcclxuICAgICAgICAnYnJlYWsnLCAnYnknLCAnYnl0ZScsICdjYXNlJyxcclxuICAgICAgICAnY2F0Y2gnLCAnY2hhcicsICdjaGVja2VkJywgJ2NsYXNzJyxcclxuICAgICAgICAnY29uc3QnLCAnY29udGludWUnLCAnZGVjaW1hbCcsICdkZWZhdWx0JyxcclxuICAgICAgICAnZGVsZWdhdGUnLCAnZG8nLCAnZG91YmxlJywgJ2Rlc2NlbmRpbmcnLFxyXG4gICAgICAgICdleHBsaWNpdCcsICdldmVudCcsICdleHRlcm4nLCAnZWxzZScsXHJcbiAgICAgICAgJ2VudW0nLCAnZmFsc2UnLCAnZmluYWxseScsICdmaXhlZCcsXHJcbiAgICAgICAgJ2Zsb2F0JywgJ2ZvcicsICdmb3JlYWNoJywgJ2Zyb20nLFxyXG4gICAgICAgICdnb3RvJywgJ2dyb3VwJywgJ2lmJywgJ2ltcGxpY2l0JyxcclxuICAgICAgICAnaW4nLCAnaW50JywgJ2ludGVyZmFjZScsICdpbnRlcm5hbCcsXHJcbiAgICAgICAgJ2ludG8nLCAnaXMnLCAnbG9jaycsICdsb25nJywgJ25hbWVvZicsXHJcbiAgICAgICAgJ25ldycsICdudWxsJywgJ25hbWVzcGFjZScsICdvYmplY3QnLFxyXG4gICAgICAgICdvcGVyYXRvcicsICdvdXQnLCAnb3ZlcnJpZGUnLCAnb3JkZXJieScsXHJcbiAgICAgICAgJ3BhcmFtcycsICdwcml2YXRlJywgJ3Byb3RlY3RlZCcsICdwdWJsaWMnLFxyXG4gICAgICAgICdyZWFkb25seScsICdyZWYnLCAncmV0dXJuJywgJ3N3aXRjaCcsXHJcbiAgICAgICAgJ3N0cnVjdCcsICdzYnl0ZScsICdzZWFsZWQnLCAnc2hvcnQnLFxyXG4gICAgICAgICdzaXplb2YnLCAnc3RhY2thbGxvYycsICdzdGF0aWMnLCAnc3RyaW5nJyxcclxuICAgICAgICAnc2VsZWN0JywgJ3RoaXMnLCAndGhyb3cnLCAndHJ1ZScsXHJcbiAgICAgICAgJ3RyeScsICd0eXBlb2YnLCAndWludCcsICd1bG9uZycsXHJcbiAgICAgICAgJ3VuY2hlY2tlZCcsICd1bnNhZmUnLCAndXNob3J0JywgJ3VzaW5nJyxcclxuICAgICAgICAndmFyJywgJ3ZpcnR1YWwnLCAndm9sYXRpbGUnLCAndm9pZCcsICd3aGVuJyxcclxuICAgICAgICAnd2hpbGUnLCAnd2hlcmUnLCAneWllbGQnLFxyXG4gICAgICAgICdtb2RlbCcsICdpbmplY3QnIC8vIFJhem9yIHNwZWNpZmljXHJcbiAgICBdLFxyXG4gICAgZXNjYXBlczogL1xcXFwoPzpbYWJmbnJ0dlxcXFxcIiddfHhbMC05QS1GYS1mXXsxLDR9fHVbMC05QS1GYS1mXXs0fXxVWzAtOUEtRmEtZl17OH0pLyxcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIifQ==