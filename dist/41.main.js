(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[41],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/python/python.js":
/*!****************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/python/python.js ***!
  \****************************************************************************/
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
var conf = {
    comments: {
        lineComment: '#',
        blockComment: ['\'\'\'', '\'\'\''],
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] },
        { open: '\'', close: '\'', notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
    ],
    onEnterRules: [
        {
            beforeText: new RegExp("^\\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async).*?:\\s*$"),
            action: { indentAction: _monaco.languages.IndentAction.Indent }
        }
    ],
    folding: {
        offSide: true,
        markers: {
            start: new RegExp("^\\s*#region\\b"),
            end: new RegExp("^\\s*#endregion\\b")
        }
    }
};
var language = {
    defaultToken: '',
    tokenPostfix: '.python',
    keywords: [
        'and',
        'as',
        'assert',
        'break',
        'class',
        'continue',
        'def',
        'del',
        'elif',
        'else',
        'except',
        'exec',
        'finally',
        'for',
        'from',
        'global',
        'if',
        'import',
        'in',
        'is',
        'lambda',
        'None',
        'not',
        'or',
        'pass',
        'print',
        'raise',
        'return',
        'self',
        'try',
        'while',
        'with',
        'yield',
        'int',
        'float',
        'long',
        'complex',
        'hex',
        'abs',
        'all',
        'any',
        'apply',
        'basestring',
        'bin',
        'bool',
        'buffer',
        'bytearray',
        'callable',
        'chr',
        'classmethod',
        'cmp',
        'coerce',
        'compile',
        'complex',
        'delattr',
        'dict',
        'dir',
        'divmod',
        'enumerate',
        'eval',
        'execfile',
        'file',
        'filter',
        'format',
        'frozenset',
        'getattr',
        'globals',
        'hasattr',
        'hash',
        'help',
        'id',
        'input',
        'intern',
        'isinstance',
        'issubclass',
        'iter',
        'len',
        'locals',
        'list',
        'map',
        'max',
        'memoryview',
        'min',
        'next',
        'object',
        'oct',
        'open',
        'ord',
        'pow',
        'print',
        'property',
        'reversed',
        'range',
        'raw_input',
        'reduce',
        'reload',
        'repr',
        'reversed',
        'round',
        'set',
        'setattr',
        'slice',
        'sorted',
        'staticmethod',
        'str',
        'sum',
        'super',
        'tuple',
        'type',
        'unichr',
        'unicode',
        'vars',
        'xrange',
        'zip',
        'True',
        'False',
        '__dict__',
        '__methods__',
        '__members__',
        '__class__',
        '__bases__',
        '__name__',
        '__mro__',
        '__subclasses__',
        '__init__',
        '__import__'
    ],
    brackets: [
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.bracket' },
        { open: '(', close: ')', token: 'delimiter.parenthesis' }
    ],
    tokenizer: {
        root: [
            { include: '@whitespace' },
            { include: '@numbers' },
            { include: '@strings' },
            [/[,:;]/, 'delimiter'],
            [/[{}\[\]()]/, '@brackets'],
            [/@[a-zA-Z]\w*/, 'tag'],
            [/[a-zA-Z]\w*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@default': 'identifier'
                    }
                }]
        ],
        // Deal with white space, including single and multi-line comments
        whitespace: [
            [/\s+/, 'white'],
            [/(^#.*$)/, 'comment'],
            [/'''/, 'string', '@endDocString'],
            [/"""/, 'string', '@endDblDocString']
        ],
        endDocString: [
            [/[^']+/, 'string'],
            [/\\'/, 'string'],
            [/'''/, 'string', '@popall'],
            [/'/, 'string']
        ],
        endDblDocString: [
            [/[^"]+/, 'string'],
            [/\\"/, 'string'],
            [/"""/, 'string', '@popall'],
            [/"/, 'string']
        ],
        // Recognize hex, negatives, decimals, imaginaries, longs, and scientific notation
        numbers: [
            [/-?0x([abcdef]|[ABCDEF]|\d)+[lL]?/, 'number.hex'],
            [/-?(\d*\.)?\d+([eE][+\-]?\d+)?[jJ]?[lL]?/, 'number']
        ],
        // Recognize strings, including those broken across lines with \ (but not without)
        strings: [
            [/'$/, 'string.escape', '@popall'],
            [/'/, 'string.escape', '@stringBody'],
            [/"$/, 'string.escape', '@popall'],
            [/"/, 'string.escape', '@dblStringBody']
        ],
        stringBody: [
            [/[^\\']+$/, 'string', '@popall'],
            [/[^\\']+/, 'string'],
            [/\\./, 'string'],
            [/'/, 'string.escape', '@popall'],
            [/\\$/, 'string']
        ],
        dblStringBody: [
            [/[^\\"]+$/, 'string', '@popall'],
            [/[^\\"]+/, 'string'],
            [/\\./, 'string'],
            [/"/, 'string.escape', '@popall'],
            [/\\$/, 'string']
        ]
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3B5dGhvbi9weXRob24uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ2E7QUFDYjtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSxXQUFXLEtBQUs7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLFNBQVMsWUFBWSxHQUFHO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMkNBQTJDO0FBQ3BELFNBQVMsd0RBQXdEO0FBQ2pFO0FBQ0E7QUFDQSxTQUFTLFNBQVMsWUFBWSxHQUFHO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCO0FBQ25DO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUJBQXFCO0FBQ3JCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksNkJBQTZCO0FBQzNELFNBQVMsb0RBQW9EO0FBQzdELFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQSxhQUFhLHlCQUF5QjtBQUN0QyxhQUFhLHNCQUFzQjtBQUNuQyxhQUFhLHNCQUFzQjtBQUNuQyxrQkFBa0I7QUFDbEIsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiNDEubWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG4ndXNlIHN0cmljdCc7XHJcbi8vIEFsbG93IGZvciBydW5uaW5nIHVuZGVyIG5vZGVqcy9yZXF1aXJlanMgaW4gdGVzdHNcclxudmFyIF9tb25hY28gPSAodHlwZW9mIG1vbmFjbyA9PT0gJ3VuZGVmaW5lZCcgPyBzZWxmLm1vbmFjbyA6IG1vbmFjbyk7XHJcbmV4cG9ydCB2YXIgY29uZiA9IHtcclxuICAgIGNvbW1lbnRzOiB7XHJcbiAgICAgICAgbGluZUNvbW1lbnQ6ICcjJyxcclxuICAgICAgICBibG9ja0NvbW1lbnQ6IFsnXFwnXFwnXFwnJywgJ1xcJ1xcJ1xcJyddLFxyXG4gICAgfSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgWyd7JywgJ30nXSxcclxuICAgICAgICBbJ1snLCAnXSddLFxyXG4gICAgICAgIFsnKCcsICcpJ11cclxuICAgIF0sXHJcbiAgICBhdXRvQ2xvc2luZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXCInLCBjbG9zZTogJ1wiJywgbm90SW46IFsnc3RyaW5nJ10gfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcclxuICAgIF0sXHJcbiAgICBzdXJyb3VuZGluZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXCInLCBjbG9zZTogJ1wiJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJyB9LFxyXG4gICAgXSxcclxuICAgIG9uRW50ZXJSdWxlczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgYmVmb3JlVGV4dDogbmV3IFJlZ0V4cChcIl5cXFxccyooPzpkZWZ8Y2xhc3N8Zm9yfGlmfGVsaWZ8ZWxzZXx3aGlsZXx0cnl8d2l0aHxmaW5hbGx5fGV4Y2VwdHxhc3luYykuKj86XFxcXHMqJFwiKSxcclxuICAgICAgICAgICAgYWN0aW9uOiB7IGluZGVudEFjdGlvbjogX21vbmFjby5sYW5ndWFnZXMuSW5kZW50QWN0aW9uLkluZGVudCB9XHJcbiAgICAgICAgfVxyXG4gICAgXSxcclxuICAgIGZvbGRpbmc6IHtcclxuICAgICAgICBvZmZTaWRlOiB0cnVlLFxyXG4gICAgICAgIG1hcmtlcnM6IHtcclxuICAgICAgICAgICAgc3RhcnQ6IG5ldyBSZWdFeHAoXCJeXFxcXHMqI3JlZ2lvblxcXFxiXCIpLFxyXG4gICAgICAgICAgICBlbmQ6IG5ldyBSZWdFeHAoXCJeXFxcXHMqI2VuZHJlZ2lvblxcXFxiXCIpXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5leHBvcnQgdmFyIGxhbmd1YWdlID0ge1xyXG4gICAgZGVmYXVsdFRva2VuOiAnJyxcclxuICAgIHRva2VuUG9zdGZpeDogJy5weXRob24nLFxyXG4gICAga2V5d29yZHM6IFtcclxuICAgICAgICAnYW5kJyxcclxuICAgICAgICAnYXMnLFxyXG4gICAgICAgICdhc3NlcnQnLFxyXG4gICAgICAgICdicmVhaycsXHJcbiAgICAgICAgJ2NsYXNzJyxcclxuICAgICAgICAnY29udGludWUnLFxyXG4gICAgICAgICdkZWYnLFxyXG4gICAgICAgICdkZWwnLFxyXG4gICAgICAgICdlbGlmJyxcclxuICAgICAgICAnZWxzZScsXHJcbiAgICAgICAgJ2V4Y2VwdCcsXHJcbiAgICAgICAgJ2V4ZWMnLFxyXG4gICAgICAgICdmaW5hbGx5JyxcclxuICAgICAgICAnZm9yJyxcclxuICAgICAgICAnZnJvbScsXHJcbiAgICAgICAgJ2dsb2JhbCcsXHJcbiAgICAgICAgJ2lmJyxcclxuICAgICAgICAnaW1wb3J0JyxcclxuICAgICAgICAnaW4nLFxyXG4gICAgICAgICdpcycsXHJcbiAgICAgICAgJ2xhbWJkYScsXHJcbiAgICAgICAgJ05vbmUnLFxyXG4gICAgICAgICdub3QnLFxyXG4gICAgICAgICdvcicsXHJcbiAgICAgICAgJ3Bhc3MnLFxyXG4gICAgICAgICdwcmludCcsXHJcbiAgICAgICAgJ3JhaXNlJyxcclxuICAgICAgICAncmV0dXJuJyxcclxuICAgICAgICAnc2VsZicsXHJcbiAgICAgICAgJ3RyeScsXHJcbiAgICAgICAgJ3doaWxlJyxcclxuICAgICAgICAnd2l0aCcsXHJcbiAgICAgICAgJ3lpZWxkJyxcclxuICAgICAgICAnaW50JyxcclxuICAgICAgICAnZmxvYXQnLFxyXG4gICAgICAgICdsb25nJyxcclxuICAgICAgICAnY29tcGxleCcsXHJcbiAgICAgICAgJ2hleCcsXHJcbiAgICAgICAgJ2FicycsXHJcbiAgICAgICAgJ2FsbCcsXHJcbiAgICAgICAgJ2FueScsXHJcbiAgICAgICAgJ2FwcGx5JyxcclxuICAgICAgICAnYmFzZXN0cmluZycsXHJcbiAgICAgICAgJ2JpbicsXHJcbiAgICAgICAgJ2Jvb2wnLFxyXG4gICAgICAgICdidWZmZXInLFxyXG4gICAgICAgICdieXRlYXJyYXknLFxyXG4gICAgICAgICdjYWxsYWJsZScsXHJcbiAgICAgICAgJ2NocicsXHJcbiAgICAgICAgJ2NsYXNzbWV0aG9kJyxcclxuICAgICAgICAnY21wJyxcclxuICAgICAgICAnY29lcmNlJyxcclxuICAgICAgICAnY29tcGlsZScsXHJcbiAgICAgICAgJ2NvbXBsZXgnLFxyXG4gICAgICAgICdkZWxhdHRyJyxcclxuICAgICAgICAnZGljdCcsXHJcbiAgICAgICAgJ2RpcicsXHJcbiAgICAgICAgJ2Rpdm1vZCcsXHJcbiAgICAgICAgJ2VudW1lcmF0ZScsXHJcbiAgICAgICAgJ2V2YWwnLFxyXG4gICAgICAgICdleGVjZmlsZScsXHJcbiAgICAgICAgJ2ZpbGUnLFxyXG4gICAgICAgICdmaWx0ZXInLFxyXG4gICAgICAgICdmb3JtYXQnLFxyXG4gICAgICAgICdmcm96ZW5zZXQnLFxyXG4gICAgICAgICdnZXRhdHRyJyxcclxuICAgICAgICAnZ2xvYmFscycsXHJcbiAgICAgICAgJ2hhc2F0dHInLFxyXG4gICAgICAgICdoYXNoJyxcclxuICAgICAgICAnaGVscCcsXHJcbiAgICAgICAgJ2lkJyxcclxuICAgICAgICAnaW5wdXQnLFxyXG4gICAgICAgICdpbnRlcm4nLFxyXG4gICAgICAgICdpc2luc3RhbmNlJyxcclxuICAgICAgICAnaXNzdWJjbGFzcycsXHJcbiAgICAgICAgJ2l0ZXInLFxyXG4gICAgICAgICdsZW4nLFxyXG4gICAgICAgICdsb2NhbHMnLFxyXG4gICAgICAgICdsaXN0JyxcclxuICAgICAgICAnbWFwJyxcclxuICAgICAgICAnbWF4JyxcclxuICAgICAgICAnbWVtb3J5dmlldycsXHJcbiAgICAgICAgJ21pbicsXHJcbiAgICAgICAgJ25leHQnLFxyXG4gICAgICAgICdvYmplY3QnLFxyXG4gICAgICAgICdvY3QnLFxyXG4gICAgICAgICdvcGVuJyxcclxuICAgICAgICAnb3JkJyxcclxuICAgICAgICAncG93JyxcclxuICAgICAgICAncHJpbnQnLFxyXG4gICAgICAgICdwcm9wZXJ0eScsXHJcbiAgICAgICAgJ3JldmVyc2VkJyxcclxuICAgICAgICAncmFuZ2UnLFxyXG4gICAgICAgICdyYXdfaW5wdXQnLFxyXG4gICAgICAgICdyZWR1Y2UnLFxyXG4gICAgICAgICdyZWxvYWQnLFxyXG4gICAgICAgICdyZXByJyxcclxuICAgICAgICAncmV2ZXJzZWQnLFxyXG4gICAgICAgICdyb3VuZCcsXHJcbiAgICAgICAgJ3NldCcsXHJcbiAgICAgICAgJ3NldGF0dHInLFxyXG4gICAgICAgICdzbGljZScsXHJcbiAgICAgICAgJ3NvcnRlZCcsXHJcbiAgICAgICAgJ3N0YXRpY21ldGhvZCcsXHJcbiAgICAgICAgJ3N0cicsXHJcbiAgICAgICAgJ3N1bScsXHJcbiAgICAgICAgJ3N1cGVyJyxcclxuICAgICAgICAndHVwbGUnLFxyXG4gICAgICAgICd0eXBlJyxcclxuICAgICAgICAndW5pY2hyJyxcclxuICAgICAgICAndW5pY29kZScsXHJcbiAgICAgICAgJ3ZhcnMnLFxyXG4gICAgICAgICd4cmFuZ2UnLFxyXG4gICAgICAgICd6aXAnLFxyXG4gICAgICAgICdUcnVlJyxcclxuICAgICAgICAnRmFsc2UnLFxyXG4gICAgICAgICdfX2RpY3RfXycsXHJcbiAgICAgICAgJ19fbWV0aG9kc19fJyxcclxuICAgICAgICAnX19tZW1iZXJzX18nLFxyXG4gICAgICAgICdfX2NsYXNzX18nLFxyXG4gICAgICAgICdfX2Jhc2VzX18nLFxyXG4gICAgICAgICdfX25hbWVfXycsXHJcbiAgICAgICAgJ19fbXJvX18nLFxyXG4gICAgICAgICdfX3N1YmNsYXNzZXNfXycsXHJcbiAgICAgICAgJ19faW5pdF9fJyxcclxuICAgICAgICAnX19pbXBvcnRfXydcclxuICAgIF0sXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nLCB0b2tlbjogJ2RlbGltaXRlci5jdXJseScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJywgdG9rZW46ICdkZWxpbWl0ZXIuYnJhY2tldCcgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJywgdG9rZW46ICdkZWxpbWl0ZXIucGFyZW50aGVzaXMnIH1cclxuICAgIF0sXHJcbiAgICB0b2tlbml6ZXI6IHtcclxuICAgICAgICByb290OiBbXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B3aGl0ZXNwYWNlJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAbnVtYmVycycgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHN0cmluZ3MnIH0sXHJcbiAgICAgICAgICAgIFsvWyw6O10vLCAnZGVsaW1pdGVyJ10sXHJcbiAgICAgICAgICAgIFsvW3t9XFxbXFxdKCldLywgJ0BicmFja2V0cyddLFxyXG4gICAgICAgICAgICBbL0BbYS16QS1aXVxcdyovLCAndGFnJ10sXHJcbiAgICAgICAgICAgIFsvW2EtekEtWl1cXHcqLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHMnOiAna2V5d29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBEZWFsIHdpdGggd2hpdGUgc3BhY2UsIGluY2x1ZGluZyBzaW5nbGUgYW5kIG11bHRpLWxpbmUgY29tbWVudHNcclxuICAgICAgICB3aGl0ZXNwYWNlOiBbXHJcbiAgICAgICAgICAgIFsvXFxzKy8sICd3aGl0ZSddLFxyXG4gICAgICAgICAgICBbLyheIy4qJCkvLCAnY29tbWVudCddLFxyXG4gICAgICAgICAgICBbLycnJy8sICdzdHJpbmcnLCAnQGVuZERvY1N0cmluZyddLFxyXG4gICAgICAgICAgICBbL1wiXCJcIi8sICdzdHJpbmcnLCAnQGVuZERibERvY1N0cmluZyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBlbmREb2NTdHJpbmc6IFtcclxuICAgICAgICAgICAgWy9bXiddKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9cXFxcJy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy8nJycvLCAnc3RyaW5nJywgJ0Bwb3BhbGwnXSxcclxuICAgICAgICAgICAgWy8nLywgJ3N0cmluZyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBlbmREYmxEb2NTdHJpbmc6IFtcclxuICAgICAgICAgICAgWy9bXlwiXSsvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXFwiLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbL1wiXCJcIi8sICdzdHJpbmcnLCAnQHBvcGFsbCddLFxyXG4gICAgICAgICAgICBbL1wiLywgJ3N0cmluZyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBSZWNvZ25pemUgaGV4LCBuZWdhdGl2ZXMsIGRlY2ltYWxzLCBpbWFnaW5hcmllcywgbG9uZ3MsIGFuZCBzY2llbnRpZmljIG5vdGF0aW9uXHJcbiAgICAgICAgbnVtYmVyczogW1xyXG4gICAgICAgICAgICBbLy0/MHgoW2FiY2RlZl18W0FCQ0RFRl18XFxkKStbbExdPy8sICdudW1iZXIuaGV4J10sXHJcbiAgICAgICAgICAgIFsvLT8oXFxkKlxcLik/XFxkKyhbZUVdWytcXC1dP1xcZCspP1tqSl0/W2xMXT8vLCAnbnVtYmVyJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIFJlY29nbml6ZSBzdHJpbmdzLCBpbmNsdWRpbmcgdGhvc2UgYnJva2VuIGFjcm9zcyBsaW5lcyB3aXRoIFxcIChidXQgbm90IHdpdGhvdXQpXHJcbiAgICAgICAgc3RyaW5nczogW1xyXG4gICAgICAgICAgICBbLyckLywgJ3N0cmluZy5lc2NhcGUnLCAnQHBvcGFsbCddLFxyXG4gICAgICAgICAgICBbLycvLCAnc3RyaW5nLmVzY2FwZScsICdAc3RyaW5nQm9keSddLFxyXG4gICAgICAgICAgICBbL1wiJC8sICdzdHJpbmcuZXNjYXBlJywgJ0Bwb3BhbGwnXSxcclxuICAgICAgICAgICAgWy9cIi8sICdzdHJpbmcuZXNjYXBlJywgJ0BkYmxTdHJpbmdCb2R5J11cclxuICAgICAgICBdLFxyXG4gICAgICAgIHN0cmluZ0JvZHk6IFtcclxuICAgICAgICAgICAgWy9bXlxcXFwnXSskLywgJ3N0cmluZycsICdAcG9wYWxsJ10sXHJcbiAgICAgICAgICAgIFsvW15cXFxcJ10rLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbL1xcXFwuLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbLycvLCAnc3RyaW5nLmVzY2FwZScsICdAcG9wYWxsJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXCQvLCAnc3RyaW5nJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIGRibFN0cmluZ0JvZHk6IFtcclxuICAgICAgICAgICAgWy9bXlxcXFxcIl0rJC8sICdzdHJpbmcnLCAnQHBvcGFsbCddLFxyXG4gICAgICAgICAgICBbL1teXFxcXFwiXSsvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXC4vLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvXCIvLCAnc3RyaW5nLmVzY2FwZScsICdAcG9wYWxsJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXCQvLCAnc3RyaW5nJ11cclxuICAgICAgICBdXHJcbiAgICB9XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiIn0=