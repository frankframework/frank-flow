(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[7],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/apex/apex.js":
/*!************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/apex/apex.js ***!
  \************************************************************************/
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

var conf = {
    // the default separators except `@$`
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
    comments: {
        lineComment: '//',
        blockComment: ['/*', '*/'],
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: '<', close: '>' },
    ],
    folding: {
        markers: {
            start: new RegExp("^\\s*//\\s*(?:(?:#?region\\b)|(?:<editor-fold\\b))"),
            end: new RegExp("^\\s*//\\s*(?:(?:#?endregion\\b)|(?:</editor-fold>))")
        }
    }
};
var keywords = [
    'abstract',
    'activate',
    'and',
    'any',
    'array',
    'as',
    'asc',
    'assert',
    'autonomous',
    'begin',
    'bigdecimal',
    'blob',
    'boolean',
    'break',
    'bulk',
    'by',
    'case',
    'cast',
    'catch',
    'char',
    'class',
    'collect',
    'commit',
    'const',
    'continue',
    'convertcurrency',
    'decimal',
    'default',
    'delete',
    'desc',
    'do',
    'double',
    'else',
    'end',
    'enum',
    'exception',
    'exit',
    'export',
    'extends',
    'false',
    'final',
    'finally',
    'float',
    'for',
    'from',
    'future',
    'get',
    'global',
    'goto',
    'group',
    'having',
    'hint',
    'if',
    'implements',
    'import',
    'in',
    'inner',
    'insert',
    'instanceof',
    'int',
    'interface',
    'into',
    'join',
    'last_90_days',
    'last_month',
    'last_n_days',
    'last_week',
    'like',
    'limit',
    'list',
    'long',
    'loop',
    'map',
    'merge',
    'native',
    'new',
    'next_90_days',
    'next_month',
    'next_n_days',
    'next_week',
    'not',
    'null',
    'nulls',
    'number',
    'object',
    'of',
    'on',
    'or',
    'outer',
    'override',
    'package',
    'parallel',
    'pragma',
    'private',
    'protected',
    'public',
    'retrieve',
    'return',
    'returning',
    'rollback',
    'savepoint',
    'search',
    'select',
    'set',
    'short',
    'sort',
    'stat',
    'static',
    'strictfp',
    'super',
    'switch',
    'synchronized',
    'system',
    'testmethod',
    'then',
    'this',
    'this_month',
    'this_week',
    'throw',
    'throws',
    'today',
    'tolabel',
    'tomorrow',
    'transaction',
    'transient',
    'trigger',
    'true',
    'try',
    'type',
    'undelete',
    'update',
    'upsert',
    'using',
    'virtual',
    'void',
    'volatile',
    'webservice',
    'when',
    'where',
    'while',
    'yesterday'
];
// create case variations of the keywords - apex is case insensitive, but we can't make the highlighter case insensitive
// because we use a heuristic to assume that identifiers starting with an upper case letter are types.
var uppercaseFirstLetter = function (lowercase) { return lowercase.charAt(0).toUpperCase() + lowercase.substr(1); };
var keywordsWithCaseVariations = [];
keywords.forEach(function (lowercase) {
    keywordsWithCaseVariations.push(lowercase);
    keywordsWithCaseVariations.push(lowercase.toUpperCase());
    keywordsWithCaseVariations.push(uppercaseFirstLetter(lowercase));
});
var language = {
    defaultToken: '',
    tokenPostfix: '.apex',
    keywords: keywordsWithCaseVariations,
    operators: [
        '=', '>', '<', '!', '~', '?', ':',
        '==', '<=', '>=', '!=', '&&', '||', '++', '--',
        '+', '-', '*', '/', '&', '|', '^', '%', '<<',
        '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
        '^=', '%=', '<<=', '>>=', '>>>='
    ],
    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    digits: /\d+(_+\d+)*/,
    octaldigits: /[0-7]+(_+[0-7]+)*/,
    binarydigits: /[0-1]+(_+[0-1]+)*/,
    hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,
    // The main tokenizer for our languages
    tokenizer: {
        root: [
            // identifiers and keywords
            [/[a-z_$][\w$]*/, {
                    cases: {
                        '@keywords': { token: 'keyword.$0' },
                        '@default': 'identifier'
                    }
                }],
            // assume that identifiers starting with an uppercase letter are types
            [/[A-Z][\w\$]*/, {
                    cases: {
                        '@keywords': { token: 'keyword.$0' },
                        '@default': 'type.identifier'
                    }
                }],
            // whitespace
            { include: '@whitespace' },
            // delimiters and operators
            [/[{}()\[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/@symbols/, {
                    cases: {
                        '@operators': 'delimiter',
                        '@default': ''
                    }
                }],
            // @ annotations.
            [/@\s*[a-zA-Z_\$][\w\$]*/, 'annotation'],
            // numbers
            [/(@digits)[eE]([\-+]?(@digits))?[fFdD]?/, 'number.float'],
            [/(@digits)\.(@digits)([eE][\-+]?(@digits))?[fFdD]?/, 'number.float'],
            [/(@digits)[fFdD]/, 'number.float'],
            [/(@digits)[lL]?/, 'number'],
            // delimiter: after number because of .\d floats
            [/[;,.]/, 'delimiter'],
            // strings
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string."'],
            [/'/, 'string', '@string.\''],
            // characters
            [/'[^\\']'/, 'string'],
            [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
            [/'/, 'string.invalid']
        ],
        whitespace: [
            [/[ \t\r\n]+/, ''],
            [/\/\*\*(?!\/)/, 'comment.doc', '@apexdoc'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment'],
        ],
        comment: [
            [/[^\/*]+/, 'comment'],
            // [/\/\*/, 'comment', '@push' ],    // nested comment not allowed :-(
            // [/\/\*/,    'comment.invalid' ],    // this breaks block comments in the shape of /* //*/
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
        ],
        //Identical copy of comment above, except for the addition of .doc
        apexdoc: [
            [/[^\/*]+/, 'comment.doc'],
            [/\*\//, 'comment.doc', '@pop'],
            [/[\/*]/, 'comment.doc']
        ],
        string: [
            [/[^\\"']+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/["']/, { cases: { '$#==$S2': { token: 'string', next: '@pop' },
                        '@default': 'string' } }]
        ],
    },
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL2FwZXgvYXBleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQSxrRUFBa0UsSUFBSSxNQUFNO0FBQzVFO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBLFdBQVcsS0FBSztBQUNoQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsU0FBUyxZQUFZLEdBQUc7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkM7QUFDQTtBQUNBLFNBQVMsU0FBUyxZQUFZLEdBQUc7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx3QkFBd0I7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaURBQWlELGdFQUFnRTtBQUNqSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQztBQUNNO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsOENBQThDLElBQUksY0FBYyxFQUFFLGNBQWMsRUFBRTtBQUNsRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNDQUFzQyxzQkFBc0I7QUFDNUQ7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQSxzQ0FBc0Msc0JBQXNCO0FBQzVEO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQSxhQUFhLHlCQUF5QjtBQUN0QztBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFnQjtBQUNoQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0IsU0FBUyxhQUFhLGdDQUFnQztBQUM1RSw4Q0FBOEMsRUFBRTtBQUNoRDtBQUNBLEtBQUs7QUFDTCIsImZpbGUiOiI3Lm1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5leHBvcnQgdmFyIGNvbmYgPSB7XHJcbiAgICAvLyB0aGUgZGVmYXVsdCBzZXBhcmF0b3JzIGV4Y2VwdCBgQCRgXHJcbiAgICB3b3JkUGF0dGVybjogLygtP1xcZCpcXC5cXGRcXHcqKXwoW15cXGBcXH5cXCFcXCNcXCVcXF5cXCZcXCpcXChcXClcXC1cXD1cXCtcXFtcXHtcXF1cXH1cXFxcXFx8XFw7XFw6XFwnXFxcIlxcLFxcLlxcPFxcPlxcL1xcP1xcc10rKS9nLFxyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBsaW5lQ29tbWVudDogJy8vJyxcclxuICAgICAgICBibG9ja0NvbW1lbnQ6IFsnLyonLCAnKi8nXSxcclxuICAgIH0sXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIFsneycsICd9J10sXHJcbiAgICAgICAgWydbJywgJ10nXSxcclxuICAgICAgICBbJygnLCAnKSddLFxyXG4gICAgXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgICAgICB7IG9wZW46ICc8JywgY2xvc2U6ICc+JyB9LFxyXG4gICAgXSxcclxuICAgIGZvbGRpbmc6IHtcclxuICAgICAgICBtYXJrZXJzOiB7XHJcbiAgICAgICAgICAgIHN0YXJ0OiBuZXcgUmVnRXhwKFwiXlxcXFxzKi8vXFxcXHMqKD86KD86Iz9yZWdpb25cXFxcYil8KD86PGVkaXRvci1mb2xkXFxcXGIpKVwiKSxcclxuICAgICAgICAgICAgZW5kOiBuZXcgUmVnRXhwKFwiXlxcXFxzKi8vXFxcXHMqKD86KD86Iz9lbmRyZWdpb25cXFxcYil8KD86PC9lZGl0b3ItZm9sZD4pKVwiKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxudmFyIGtleXdvcmRzID0gW1xyXG4gICAgJ2Fic3RyYWN0JyxcclxuICAgICdhY3RpdmF0ZScsXHJcbiAgICAnYW5kJyxcclxuICAgICdhbnknLFxyXG4gICAgJ2FycmF5JyxcclxuICAgICdhcycsXHJcbiAgICAnYXNjJyxcclxuICAgICdhc3NlcnQnLFxyXG4gICAgJ2F1dG9ub21vdXMnLFxyXG4gICAgJ2JlZ2luJyxcclxuICAgICdiaWdkZWNpbWFsJyxcclxuICAgICdibG9iJyxcclxuICAgICdib29sZWFuJyxcclxuICAgICdicmVhaycsXHJcbiAgICAnYnVsaycsXHJcbiAgICAnYnknLFxyXG4gICAgJ2Nhc2UnLFxyXG4gICAgJ2Nhc3QnLFxyXG4gICAgJ2NhdGNoJyxcclxuICAgICdjaGFyJyxcclxuICAgICdjbGFzcycsXHJcbiAgICAnY29sbGVjdCcsXHJcbiAgICAnY29tbWl0JyxcclxuICAgICdjb25zdCcsXHJcbiAgICAnY29udGludWUnLFxyXG4gICAgJ2NvbnZlcnRjdXJyZW5jeScsXHJcbiAgICAnZGVjaW1hbCcsXHJcbiAgICAnZGVmYXVsdCcsXHJcbiAgICAnZGVsZXRlJyxcclxuICAgICdkZXNjJyxcclxuICAgICdkbycsXHJcbiAgICAnZG91YmxlJyxcclxuICAgICdlbHNlJyxcclxuICAgICdlbmQnLFxyXG4gICAgJ2VudW0nLFxyXG4gICAgJ2V4Y2VwdGlvbicsXHJcbiAgICAnZXhpdCcsXHJcbiAgICAnZXhwb3J0JyxcclxuICAgICdleHRlbmRzJyxcclxuICAgICdmYWxzZScsXHJcbiAgICAnZmluYWwnLFxyXG4gICAgJ2ZpbmFsbHknLFxyXG4gICAgJ2Zsb2F0JyxcclxuICAgICdmb3InLFxyXG4gICAgJ2Zyb20nLFxyXG4gICAgJ2Z1dHVyZScsXHJcbiAgICAnZ2V0JyxcclxuICAgICdnbG9iYWwnLFxyXG4gICAgJ2dvdG8nLFxyXG4gICAgJ2dyb3VwJyxcclxuICAgICdoYXZpbmcnLFxyXG4gICAgJ2hpbnQnLFxyXG4gICAgJ2lmJyxcclxuICAgICdpbXBsZW1lbnRzJyxcclxuICAgICdpbXBvcnQnLFxyXG4gICAgJ2luJyxcclxuICAgICdpbm5lcicsXHJcbiAgICAnaW5zZXJ0JyxcclxuICAgICdpbnN0YW5jZW9mJyxcclxuICAgICdpbnQnLFxyXG4gICAgJ2ludGVyZmFjZScsXHJcbiAgICAnaW50bycsXHJcbiAgICAnam9pbicsXHJcbiAgICAnbGFzdF85MF9kYXlzJyxcclxuICAgICdsYXN0X21vbnRoJyxcclxuICAgICdsYXN0X25fZGF5cycsXHJcbiAgICAnbGFzdF93ZWVrJyxcclxuICAgICdsaWtlJyxcclxuICAgICdsaW1pdCcsXHJcbiAgICAnbGlzdCcsXHJcbiAgICAnbG9uZycsXHJcbiAgICAnbG9vcCcsXHJcbiAgICAnbWFwJyxcclxuICAgICdtZXJnZScsXHJcbiAgICAnbmF0aXZlJyxcclxuICAgICduZXcnLFxyXG4gICAgJ25leHRfOTBfZGF5cycsXHJcbiAgICAnbmV4dF9tb250aCcsXHJcbiAgICAnbmV4dF9uX2RheXMnLFxyXG4gICAgJ25leHRfd2VlaycsXHJcbiAgICAnbm90JyxcclxuICAgICdudWxsJyxcclxuICAgICdudWxscycsXHJcbiAgICAnbnVtYmVyJyxcclxuICAgICdvYmplY3QnLFxyXG4gICAgJ29mJyxcclxuICAgICdvbicsXHJcbiAgICAnb3InLFxyXG4gICAgJ291dGVyJyxcclxuICAgICdvdmVycmlkZScsXHJcbiAgICAncGFja2FnZScsXHJcbiAgICAncGFyYWxsZWwnLFxyXG4gICAgJ3ByYWdtYScsXHJcbiAgICAncHJpdmF0ZScsXHJcbiAgICAncHJvdGVjdGVkJyxcclxuICAgICdwdWJsaWMnLFxyXG4gICAgJ3JldHJpZXZlJyxcclxuICAgICdyZXR1cm4nLFxyXG4gICAgJ3JldHVybmluZycsXHJcbiAgICAncm9sbGJhY2snLFxyXG4gICAgJ3NhdmVwb2ludCcsXHJcbiAgICAnc2VhcmNoJyxcclxuICAgICdzZWxlY3QnLFxyXG4gICAgJ3NldCcsXHJcbiAgICAnc2hvcnQnLFxyXG4gICAgJ3NvcnQnLFxyXG4gICAgJ3N0YXQnLFxyXG4gICAgJ3N0YXRpYycsXHJcbiAgICAnc3RyaWN0ZnAnLFxyXG4gICAgJ3N1cGVyJyxcclxuICAgICdzd2l0Y2gnLFxyXG4gICAgJ3N5bmNocm9uaXplZCcsXHJcbiAgICAnc3lzdGVtJyxcclxuICAgICd0ZXN0bWV0aG9kJyxcclxuICAgICd0aGVuJyxcclxuICAgICd0aGlzJyxcclxuICAgICd0aGlzX21vbnRoJyxcclxuICAgICd0aGlzX3dlZWsnLFxyXG4gICAgJ3Rocm93JyxcclxuICAgICd0aHJvd3MnLFxyXG4gICAgJ3RvZGF5JyxcclxuICAgICd0b2xhYmVsJyxcclxuICAgICd0b21vcnJvdycsXHJcbiAgICAndHJhbnNhY3Rpb24nLFxyXG4gICAgJ3RyYW5zaWVudCcsXHJcbiAgICAndHJpZ2dlcicsXHJcbiAgICAndHJ1ZScsXHJcbiAgICAndHJ5JyxcclxuICAgICd0eXBlJyxcclxuICAgICd1bmRlbGV0ZScsXHJcbiAgICAndXBkYXRlJyxcclxuICAgICd1cHNlcnQnLFxyXG4gICAgJ3VzaW5nJyxcclxuICAgICd2aXJ0dWFsJyxcclxuICAgICd2b2lkJyxcclxuICAgICd2b2xhdGlsZScsXHJcbiAgICAnd2Vic2VydmljZScsXHJcbiAgICAnd2hlbicsXHJcbiAgICAnd2hlcmUnLFxyXG4gICAgJ3doaWxlJyxcclxuICAgICd5ZXN0ZXJkYXknXHJcbl07XHJcbi8vIGNyZWF0ZSBjYXNlIHZhcmlhdGlvbnMgb2YgdGhlIGtleXdvcmRzIC0gYXBleCBpcyBjYXNlIGluc2Vuc2l0aXZlLCBidXQgd2UgY2FuJ3QgbWFrZSB0aGUgaGlnaGxpZ2h0ZXIgY2FzZSBpbnNlbnNpdGl2ZVxyXG4vLyBiZWNhdXNlIHdlIHVzZSBhIGhldXJpc3RpYyB0byBhc3N1bWUgdGhhdCBpZGVudGlmaWVycyBzdGFydGluZyB3aXRoIGFuIHVwcGVyIGNhc2UgbGV0dGVyIGFyZSB0eXBlcy5cclxudmFyIHVwcGVyY2FzZUZpcnN0TGV0dGVyID0gZnVuY3Rpb24gKGxvd2VyY2FzZSkgeyByZXR1cm4gbG93ZXJjYXNlLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbG93ZXJjYXNlLnN1YnN0cigxKTsgfTtcclxudmFyIGtleXdvcmRzV2l0aENhc2VWYXJpYXRpb25zID0gW107XHJcbmtleXdvcmRzLmZvckVhY2goZnVuY3Rpb24gKGxvd2VyY2FzZSkge1xyXG4gICAga2V5d29yZHNXaXRoQ2FzZVZhcmlhdGlvbnMucHVzaChsb3dlcmNhc2UpO1xyXG4gICAga2V5d29yZHNXaXRoQ2FzZVZhcmlhdGlvbnMucHVzaChsb3dlcmNhc2UudG9VcHBlckNhc2UoKSk7XHJcbiAgICBrZXl3b3Jkc1dpdGhDYXNlVmFyaWF0aW9ucy5wdXNoKHVwcGVyY2FzZUZpcnN0TGV0dGVyKGxvd2VyY2FzZSkpO1xyXG59KTtcclxuZXhwb3J0IHZhciBsYW5ndWFnZSA9IHtcclxuICAgIGRlZmF1bHRUb2tlbjogJycsXHJcbiAgICB0b2tlblBvc3RmaXg6ICcuYXBleCcsXHJcbiAgICBrZXl3b3Jkczoga2V5d29yZHNXaXRoQ2FzZVZhcmlhdGlvbnMsXHJcbiAgICBvcGVyYXRvcnM6IFtcclxuICAgICAgICAnPScsICc+JywgJzwnLCAnIScsICd+JywgJz8nLCAnOicsXHJcbiAgICAgICAgJz09JywgJzw9JywgJz49JywgJyE9JywgJyYmJywgJ3x8JywgJysrJywgJy0tJyxcclxuICAgICAgICAnKycsICctJywgJyonLCAnLycsICcmJywgJ3wnLCAnXicsICclJywgJzw8JyxcclxuICAgICAgICAnPj4nLCAnPj4+JywgJys9JywgJy09JywgJyo9JywgJy89JywgJyY9JywgJ3w9JyxcclxuICAgICAgICAnXj0nLCAnJT0nLCAnPDw9JywgJz4+PScsICc+Pj49J1xyXG4gICAgXSxcclxuICAgIC8vIHdlIGluY2x1ZGUgdGhlc2UgY29tbW9uIHJlZ3VsYXIgZXhwcmVzc2lvbnNcclxuICAgIHN5bWJvbHM6IC9bPT48IX4/OiZ8K1xcLSpcXC9cXF4lXSsvLFxyXG4gICAgZXNjYXBlczogL1xcXFwoPzpbYWJmbnJ0dlxcXFxcIiddfHhbMC05QS1GYS1mXXsxLDR9fHVbMC05QS1GYS1mXXs0fXxVWzAtOUEtRmEtZl17OH0pLyxcclxuICAgIGRpZ2l0czogL1xcZCsoXytcXGQrKSovLFxyXG4gICAgb2N0YWxkaWdpdHM6IC9bMC03XSsoXytbMC03XSspKi8sXHJcbiAgICBiaW5hcnlkaWdpdHM6IC9bMC0xXSsoXytbMC0xXSspKi8sXHJcbiAgICBoZXhkaWdpdHM6IC9bWzAtOWEtZkEtRl0rKF8rWzAtOWEtZkEtRl0rKSovLFxyXG4gICAgLy8gVGhlIG1haW4gdG9rZW5pemVyIGZvciBvdXIgbGFuZ3VhZ2VzXHJcbiAgICB0b2tlbml6ZXI6IHtcclxuICAgICAgICByb290OiBbXHJcbiAgICAgICAgICAgIC8vIGlkZW50aWZpZXJzIGFuZCBrZXl3b3Jkc1xyXG4gICAgICAgICAgICBbL1thLXpfJF1bXFx3JF0qLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHMnOiB7IHRva2VuOiAna2V5d29yZC4kMCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ2lkZW50aWZpZXInXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgIC8vIGFzc3VtZSB0aGF0IGlkZW50aWZpZXJzIHN0YXJ0aW5nIHdpdGggYW4gdXBwZXJjYXNlIGxldHRlciBhcmUgdHlwZXNcclxuICAgICAgICAgICAgWy9bQS1aXVtcXHdcXCRdKi8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogeyB0b2tlbjogJ2tleXdvcmQuJDAnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICd0eXBlLmlkZW50aWZpZXInXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgIC8vIHdoaXRlc3BhY2VcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHdoaXRlc3BhY2UnIH0sXHJcbiAgICAgICAgICAgIC8vIGRlbGltaXRlcnMgYW5kIG9wZXJhdG9yc1xyXG4gICAgICAgICAgICBbL1t7fSgpXFxbXFxdXS8sICdAYnJhY2tldHMnXSxcclxuICAgICAgICAgICAgWy9bPD5dKD8hQHN5bWJvbHMpLywgJ0BicmFja2V0cyddLFxyXG4gICAgICAgICAgICBbL0BzeW1ib2xzLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAb3BlcmF0b3JzJzogJ2RlbGltaXRlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICcnXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgIC8vIEAgYW5ub3RhdGlvbnMuXHJcbiAgICAgICAgICAgIFsvQFxccypbYS16QS1aX1xcJF1bXFx3XFwkXSovLCAnYW5ub3RhdGlvbiddLFxyXG4gICAgICAgICAgICAvLyBudW1iZXJzXHJcbiAgICAgICAgICAgIFsvKEBkaWdpdHMpW2VFXShbXFwtK10/KEBkaWdpdHMpKT9bZkZkRF0/LywgJ251bWJlci5mbG9hdCddLFxyXG4gICAgICAgICAgICBbLyhAZGlnaXRzKVxcLihAZGlnaXRzKShbZUVdW1xcLStdPyhAZGlnaXRzKSk/W2ZGZERdPy8sICdudW1iZXIuZmxvYXQnXSxcclxuICAgICAgICAgICAgWy8oQGRpZ2l0cylbZkZkRF0vLCAnbnVtYmVyLmZsb2F0J10sXHJcbiAgICAgICAgICAgIFsvKEBkaWdpdHMpW2xMXT8vLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIC8vIGRlbGltaXRlcjogYWZ0ZXIgbnVtYmVyIGJlY2F1c2Ugb2YgLlxcZCBmbG9hdHNcclxuICAgICAgICAgICAgWy9bOywuXS8sICdkZWxpbWl0ZXInXSxcclxuICAgICAgICAgICAgLy8gc3RyaW5nc1xyXG4gICAgICAgICAgICBbL1wiKFteXCJcXFxcXXxcXFxcLikqJC8sICdzdHJpbmcuaW52YWxpZCddLFxyXG4gICAgICAgICAgICBbLycoW14nXFxcXF18XFxcXC4pKiQvLCAnc3RyaW5nLmludmFsaWQnXSxcclxuICAgICAgICAgICAgWy9cIi8sICdzdHJpbmcnLCAnQHN0cmluZy5cIiddLFxyXG4gICAgICAgICAgICBbLycvLCAnc3RyaW5nJywgJ0BzdHJpbmcuXFwnJ10sXHJcbiAgICAgICAgICAgIC8vIGNoYXJhY3RlcnNcclxuICAgICAgICAgICAgWy8nW15cXFxcJ10nLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbLygnKShAZXNjYXBlcykoJykvLCBbJ3N0cmluZycsICdzdHJpbmcuZXNjYXBlJywgJ3N0cmluZyddXSxcclxuICAgICAgICAgICAgWy8nLywgJ3N0cmluZy5pbnZhbGlkJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIHdoaXRlc3BhY2U6IFtcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rLywgJyddLFxyXG4gICAgICAgICAgICBbL1xcL1xcKlxcKig/IVxcLykvLCAnY29tbWVudC5kb2MnLCAnQGFwZXhkb2MnXSxcclxuICAgICAgICAgICAgWy9cXC9cXCovLCAnY29tbWVudCcsICdAY29tbWVudCddLFxyXG4gICAgICAgICAgICBbL1xcL1xcLy4qJC8sICdjb21tZW50J10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjb21tZW50OiBbXHJcbiAgICAgICAgICAgIFsvW15cXC8qXSsvLCAnY29tbWVudCddLFxyXG4gICAgICAgICAgICAvLyBbL1xcL1xcKi8sICdjb21tZW50JywgJ0BwdXNoJyBdLCAgICAvLyBuZXN0ZWQgY29tbWVudCBub3QgYWxsb3dlZCA6LShcclxuICAgICAgICAgICAgLy8gWy9cXC9cXCovLCAgICAnY29tbWVudC5pbnZhbGlkJyBdLCAgICAvLyB0aGlzIGJyZWFrcyBibG9jayBjb21tZW50cyBpbiB0aGUgc2hhcGUgb2YgLyogLy8qL1xyXG4gICAgICAgICAgICBbL1xcKlxcLy8sICdjb21tZW50JywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9bXFwvKl0vLCAnY29tbWVudCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvL0lkZW50aWNhbCBjb3B5IG9mIGNvbW1lbnQgYWJvdmUsIGV4Y2VwdCBmb3IgdGhlIGFkZGl0aW9uIG9mIC5kb2NcclxuICAgICAgICBhcGV4ZG9jOiBbXHJcbiAgICAgICAgICAgIFsvW15cXC8qXSsvLCAnY29tbWVudC5kb2MnXSxcclxuICAgICAgICAgICAgWy9cXCpcXC8vLCAnY29tbWVudC5kb2MnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbL1tcXC8qXS8sICdjb21tZW50LmRvYyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzdHJpbmc6IFtcclxuICAgICAgICAgICAgWy9bXlxcXFxcIiddKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9AZXNjYXBlcy8sICdzdHJpbmcuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXC4vLCAnc3RyaW5nLmVzY2FwZS5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvW1wiJ10vLCB7IGNhc2VzOiB7ICckIz09JFMyJzogeyB0b2tlbjogJ3N0cmluZycsIG5leHQ6ICdAcG9wJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnc3RyaW5nJyB9IH1dXHJcbiAgICAgICAgXSxcclxuICAgIH0sXHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiIn0=