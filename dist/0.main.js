(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/cpp/cpp.js":
/*!**********************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/cpp/cpp.js ***!
  \**********************************************************************/
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
    comments: {
        lineComment: '//',
        blockComment: ['/*', '*/'],
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
    ],
    autoClosingPairs: [
        { open: '[', close: ']' },
        { open: '{', close: '}' },
        { open: '(', close: ')' },
        { open: '\'', close: '\'', notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string'] },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
    ],
    folding: {
        markers: {
            start: new RegExp("^\\s*#pragma\\s+region\\b"),
            end: new RegExp("^\\s*#pragma\\s+endregion\\b")
        }
    }
};
var language = {
    defaultToken: '',
    tokenPostfix: '.cpp',
    brackets: [
        { token: 'delimiter.curly', open: '{', close: '}' },
        { token: 'delimiter.parenthesis', open: '(', close: ')' },
        { token: 'delimiter.square', open: '[', close: ']' },
        { token: 'delimiter.angle', open: '<', close: '>' }
    ],
    keywords: [
        'abstract',
        'amp',
        'array',
        'auto',
        'bool',
        'break',
        'case',
        'catch',
        'char',
        'class',
        'const',
        'constexpr',
        'const_cast',
        'continue',
        'cpu',
        'decltype',
        'default',
        'delegate',
        'delete',
        'do',
        'double',
        'dynamic_cast',
        'each',
        'else',
        'enum',
        'event',
        'explicit',
        'export',
        'extern',
        'false',
        'final',
        'finally',
        'float',
        'for',
        'friend',
        'gcnew',
        'generic',
        'goto',
        'if',
        'in',
        'initonly',
        'inline',
        'int',
        'interface',
        'interior_ptr',
        'internal',
        'literal',
        'long',
        'mutable',
        'namespace',
        'new',
        'noexcept',
        'nullptr',
        '__nullptr',
        'operator',
        'override',
        'partial',
        'pascal',
        'pin_ptr',
        'private',
        'property',
        'protected',
        'public',
        'ref',
        'register',
        'reinterpret_cast',
        'restrict',
        'return',
        'safe_cast',
        'sealed',
        'short',
        'signed',
        'sizeof',
        'static',
        'static_assert',
        'static_cast',
        'struct',
        'switch',
        'template',
        'this',
        'thread_local',
        'throw',
        'tile_static',
        'true',
        'try',
        'typedef',
        'typeid',
        'typename',
        'union',
        'unsigned',
        'using',
        'virtual',
        'void',
        'volatile',
        'wchar_t',
        'where',
        'while',
        '_asm',
        '_based',
        '_cdecl',
        '_declspec',
        '_fastcall',
        '_if_exists',
        '_if_not_exists',
        '_inline',
        '_multiple_inheritance',
        '_pascal',
        '_single_inheritance',
        '_stdcall',
        '_virtual_inheritance',
        '_w64',
        '__abstract',
        '__alignof',
        '__asm',
        '__assume',
        '__based',
        '__box',
        '__builtin_alignof',
        '__cdecl',
        '__clrcall',
        '__declspec',
        '__delegate',
        '__event',
        '__except',
        '__fastcall',
        '__finally',
        '__forceinline',
        '__gc',
        '__hook',
        '__identifier',
        '__if_exists',
        '__if_not_exists',
        '__inline',
        '__int128',
        '__int16',
        '__int32',
        '__int64',
        '__int8',
        '__interface',
        '__leave',
        '__m128',
        '__m128d',
        '__m128i',
        '__m256',
        '__m256d',
        '__m256i',
        '__m64',
        '__multiple_inheritance',
        '__newslot',
        '__nogc',
        '__noop',
        '__nounwind',
        '__novtordisp',
        '__pascal',
        '__pin',
        '__pragma',
        '__property',
        '__ptr32',
        '__ptr64',
        '__raise',
        '__restrict',
        '__resume',
        '__sealed',
        '__single_inheritance',
        '__stdcall',
        '__super',
        '__thiscall',
        '__try',
        '__try_cast',
        '__typeof',
        '__unaligned',
        '__unhook',
        '__uuidof',
        '__value',
        '__virtual_inheritance',
        '__w64',
        '__wchar_t'
    ],
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
    integersuffix: /(ll|LL|u|U|l|L)?(ll|LL|u|U|l|L)?/,
    floatsuffix: /[fFlL]?/,
    encoding: /u|u8|U|L/,
    // The main tokenizer for our languages
    tokenizer: {
        root: [
            // C++ 11 Raw String
            [/@encoding?R\"(?:([^ ()\\\t]*))\(/, { token: 'string.raw.begin', next: '@raw.$1' }],
            // identifiers and keywords
            [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@keywords': { token: 'keyword.$0' },
                        '@default': 'identifier'
                    }
                }],
            // whitespace
            { include: '@whitespace' },
            // [[ attributes ]].
            [/\[\[.*\]\]/, 'annotation'],
            [/^\s*#include/, { token: 'keyword.directive.include', next: '@include' }],
            // Preprocessor directive
            [/^\s*#\s*\w+/, 'keyword'],
            // delimiters and operators
            [/[{}()\[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/@symbols/, {
                    cases: {
                        '@operators': 'delimiter',
                        '@default': ''
                    }
                }],
            // numbers
            [/\d*\d+[eE]([\-+]?\d+)?(@floatsuffix)/, 'number.float'],
            [/\d*\.\d+([eE][\-+]?\d+)?(@floatsuffix)/, 'number.float'],
            [/0[xX][0-9a-fA-F']*[0-9a-fA-F](@integersuffix)/, 'number.hex'],
            [/0[0-7']*[0-7](@integersuffix)/, 'number.octal'],
            [/0[bB][0-1']*[0-1](@integersuffix)/, 'number.binary'],
            [/\d[\d']*\d(@integersuffix)/, 'number'],
            [/\d(@integersuffix)/, 'number'],
            // delimiter: after number because of .\d floats
            [/[;,.]/, 'delimiter'],
            // strings
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string'],
            // characters
            [/'[^\\']'/, 'string'],
            [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
            [/'/, 'string.invalid']
        ],
        whitespace: [
            [/[ \t\r\n]+/, ''],
            [/\/\*\*(?!\/)/, 'comment.doc', '@doccomment'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment'],
        ],
        comment: [
            [/[^\/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
        ],
        //Identical copy of comment above, except for the addition of .doc
        doccomment: [
            [/[^\/*]+/, 'comment.doc'],
            [/\*\//, 'comment.doc', '@pop'],
            [/[\/*]/, 'comment.doc']
        ],
        string: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, 'string', '@pop']
        ],
        raw: [
            [/(.*)(\))(?:([^ ()\\\t]*))(\")/, {
                    cases: {
                        '$3==$S2': ['string.raw', 'string.raw.end', 'string.raw.end', { token: 'string.raw.end', next: '@pop' }],
                        '@default': ['string.raw', 'string.raw', 'string.raw', 'string.raw']
                    }
                }
            ],
            [/.*/, 'string.raw']
        ],
        include: [
            [/(\s*)(<)([^<>]*)(>)/, ['', 'keyword.directive.include.begin', 'string.include.identifier', { token: 'keyword.directive.include.end', next: '@pop' }]],
            [/(\s*)(")([^"]*)(")/, ['', 'keyword.directive.include.begin', 'string.include.identifier', { token: 'keyword.directive.include.end', next: '@pop' }]]
        ]
    },
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL2NwcC9jcHAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ2E7QUFDTjtBQUNQO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBLFdBQVcsS0FBSztBQUNoQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsU0FBUyxZQUFZLEdBQUc7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3REFBd0Q7QUFDakUsU0FBUywyQ0FBMkM7QUFDcEQ7QUFDQTtBQUNBLFNBQVMsU0FBUyxZQUFZLEdBQUc7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsU0FBUyxtQ0FBbUMsWUFBWSxHQUFHO0FBQzNELFNBQVMsd0RBQXdEO0FBQ2pFLFNBQVMsbURBQW1EO0FBQzVELFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4Q0FBOEMsSUFBSSxjQUFjLEVBQUUsY0FBYyxFQUFFO0FBQ2xGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0RBQWtELDZDQUE2QztBQUMvRjtBQUNBO0FBQ0E7QUFDQSxzQ0FBc0Msc0JBQXNCO0FBQzVEO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQSxhQUFhLHlCQUF5QjtBQUN0QztBQUNBO0FBQ0EsOEJBQThCLHVEQUF1RDtBQUNyRjtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFnQjtBQUNoQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVGQUF1Rix3Q0FBd0M7QUFDL0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwwR0FBMEcsdURBQXVEO0FBQ2pLLHlHQUF5Ryx1REFBdUQ7QUFDaEs7QUFDQSxLQUFLO0FBQ0wiLCJmaWxlIjoiMC5tYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBsaW5lQ29tbWVudDogJy8vJyxcclxuICAgICAgICBibG9ja0NvbW1lbnQ6IFsnLyonLCAnKi8nXSxcclxuICAgIH0sXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIFsneycsICd9J10sXHJcbiAgICAgICAgWydbJywgJ10nXSxcclxuICAgICAgICBbJygnLCAnKSddXHJcbiAgICBdLFxyXG4gICAgYXV0b0Nsb3NpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicsIG5vdEluOiBbJ3N0cmluZyddIH0sXHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgIF0sXHJcbiAgICBmb2xkaW5nOiB7XHJcbiAgICAgICAgbWFya2Vyczoge1xyXG4gICAgICAgICAgICBzdGFydDogbmV3IFJlZ0V4cChcIl5cXFxccyojcHJhZ21hXFxcXHMrcmVnaW9uXFxcXGJcIiksXHJcbiAgICAgICAgICAgIGVuZDogbmV3IFJlZ0V4cChcIl5cXFxccyojcHJhZ21hXFxcXHMrZW5kcmVnaW9uXFxcXGJcIilcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcbmV4cG9ydCB2YXIgbGFuZ3VhZ2UgPSB7XHJcbiAgICBkZWZhdWx0VG9rZW46ICcnLFxyXG4gICAgdG9rZW5Qb3N0Zml4OiAnLmNwcCcsXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIHsgdG9rZW46ICdkZWxpbWl0ZXIuY3VybHknLCBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IHRva2VuOiAnZGVsaW1pdGVyLnBhcmVudGhlc2lzJywgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyB0b2tlbjogJ2RlbGltaXRlci5zcXVhcmUnLCBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IHRva2VuOiAnZGVsaW1pdGVyLmFuZ2xlJywgb3BlbjogJzwnLCBjbG9zZTogJz4nIH1cclxuICAgIF0sXHJcbiAgICBrZXl3b3JkczogW1xyXG4gICAgICAgICdhYnN0cmFjdCcsXHJcbiAgICAgICAgJ2FtcCcsXHJcbiAgICAgICAgJ2FycmF5JyxcclxuICAgICAgICAnYXV0bycsXHJcbiAgICAgICAgJ2Jvb2wnLFxyXG4gICAgICAgICdicmVhaycsXHJcbiAgICAgICAgJ2Nhc2UnLFxyXG4gICAgICAgICdjYXRjaCcsXHJcbiAgICAgICAgJ2NoYXInLFxyXG4gICAgICAgICdjbGFzcycsXHJcbiAgICAgICAgJ2NvbnN0JyxcclxuICAgICAgICAnY29uc3RleHByJyxcclxuICAgICAgICAnY29uc3RfY2FzdCcsXHJcbiAgICAgICAgJ2NvbnRpbnVlJyxcclxuICAgICAgICAnY3B1JyxcclxuICAgICAgICAnZGVjbHR5cGUnLFxyXG4gICAgICAgICdkZWZhdWx0JyxcclxuICAgICAgICAnZGVsZWdhdGUnLFxyXG4gICAgICAgICdkZWxldGUnLFxyXG4gICAgICAgICdkbycsXHJcbiAgICAgICAgJ2RvdWJsZScsXHJcbiAgICAgICAgJ2R5bmFtaWNfY2FzdCcsXHJcbiAgICAgICAgJ2VhY2gnLFxyXG4gICAgICAgICdlbHNlJyxcclxuICAgICAgICAnZW51bScsXHJcbiAgICAgICAgJ2V2ZW50JyxcclxuICAgICAgICAnZXhwbGljaXQnLFxyXG4gICAgICAgICdleHBvcnQnLFxyXG4gICAgICAgICdleHRlcm4nLFxyXG4gICAgICAgICdmYWxzZScsXHJcbiAgICAgICAgJ2ZpbmFsJyxcclxuICAgICAgICAnZmluYWxseScsXHJcbiAgICAgICAgJ2Zsb2F0JyxcclxuICAgICAgICAnZm9yJyxcclxuICAgICAgICAnZnJpZW5kJyxcclxuICAgICAgICAnZ2NuZXcnLFxyXG4gICAgICAgICdnZW5lcmljJyxcclxuICAgICAgICAnZ290bycsXHJcbiAgICAgICAgJ2lmJyxcclxuICAgICAgICAnaW4nLFxyXG4gICAgICAgICdpbml0b25seScsXHJcbiAgICAgICAgJ2lubGluZScsXHJcbiAgICAgICAgJ2ludCcsXHJcbiAgICAgICAgJ2ludGVyZmFjZScsXHJcbiAgICAgICAgJ2ludGVyaW9yX3B0cicsXHJcbiAgICAgICAgJ2ludGVybmFsJyxcclxuICAgICAgICAnbGl0ZXJhbCcsXHJcbiAgICAgICAgJ2xvbmcnLFxyXG4gICAgICAgICdtdXRhYmxlJyxcclxuICAgICAgICAnbmFtZXNwYWNlJyxcclxuICAgICAgICAnbmV3JyxcclxuICAgICAgICAnbm9leGNlcHQnLFxyXG4gICAgICAgICdudWxscHRyJyxcclxuICAgICAgICAnX19udWxscHRyJyxcclxuICAgICAgICAnb3BlcmF0b3InLFxyXG4gICAgICAgICdvdmVycmlkZScsXHJcbiAgICAgICAgJ3BhcnRpYWwnLFxyXG4gICAgICAgICdwYXNjYWwnLFxyXG4gICAgICAgICdwaW5fcHRyJyxcclxuICAgICAgICAncHJpdmF0ZScsXHJcbiAgICAgICAgJ3Byb3BlcnR5JyxcclxuICAgICAgICAncHJvdGVjdGVkJyxcclxuICAgICAgICAncHVibGljJyxcclxuICAgICAgICAncmVmJyxcclxuICAgICAgICAncmVnaXN0ZXInLFxyXG4gICAgICAgICdyZWludGVycHJldF9jYXN0JyxcclxuICAgICAgICAncmVzdHJpY3QnLFxyXG4gICAgICAgICdyZXR1cm4nLFxyXG4gICAgICAgICdzYWZlX2Nhc3QnLFxyXG4gICAgICAgICdzZWFsZWQnLFxyXG4gICAgICAgICdzaG9ydCcsXHJcbiAgICAgICAgJ3NpZ25lZCcsXHJcbiAgICAgICAgJ3NpemVvZicsXHJcbiAgICAgICAgJ3N0YXRpYycsXHJcbiAgICAgICAgJ3N0YXRpY19hc3NlcnQnLFxyXG4gICAgICAgICdzdGF0aWNfY2FzdCcsXHJcbiAgICAgICAgJ3N0cnVjdCcsXHJcbiAgICAgICAgJ3N3aXRjaCcsXHJcbiAgICAgICAgJ3RlbXBsYXRlJyxcclxuICAgICAgICAndGhpcycsXHJcbiAgICAgICAgJ3RocmVhZF9sb2NhbCcsXHJcbiAgICAgICAgJ3Rocm93JyxcclxuICAgICAgICAndGlsZV9zdGF0aWMnLFxyXG4gICAgICAgICd0cnVlJyxcclxuICAgICAgICAndHJ5JyxcclxuICAgICAgICAndHlwZWRlZicsXHJcbiAgICAgICAgJ3R5cGVpZCcsXHJcbiAgICAgICAgJ3R5cGVuYW1lJyxcclxuICAgICAgICAndW5pb24nLFxyXG4gICAgICAgICd1bnNpZ25lZCcsXHJcbiAgICAgICAgJ3VzaW5nJyxcclxuICAgICAgICAndmlydHVhbCcsXHJcbiAgICAgICAgJ3ZvaWQnLFxyXG4gICAgICAgICd2b2xhdGlsZScsXHJcbiAgICAgICAgJ3djaGFyX3QnLFxyXG4gICAgICAgICd3aGVyZScsXHJcbiAgICAgICAgJ3doaWxlJyxcclxuICAgICAgICAnX2FzbScsXHJcbiAgICAgICAgJ19iYXNlZCcsXHJcbiAgICAgICAgJ19jZGVjbCcsXHJcbiAgICAgICAgJ19kZWNsc3BlYycsXHJcbiAgICAgICAgJ19mYXN0Y2FsbCcsXHJcbiAgICAgICAgJ19pZl9leGlzdHMnLFxyXG4gICAgICAgICdfaWZfbm90X2V4aXN0cycsXHJcbiAgICAgICAgJ19pbmxpbmUnLFxyXG4gICAgICAgICdfbXVsdGlwbGVfaW5oZXJpdGFuY2UnLFxyXG4gICAgICAgICdfcGFzY2FsJyxcclxuICAgICAgICAnX3NpbmdsZV9pbmhlcml0YW5jZScsXHJcbiAgICAgICAgJ19zdGRjYWxsJyxcclxuICAgICAgICAnX3ZpcnR1YWxfaW5oZXJpdGFuY2UnLFxyXG4gICAgICAgICdfdzY0JyxcclxuICAgICAgICAnX19hYnN0cmFjdCcsXHJcbiAgICAgICAgJ19fYWxpZ25vZicsXHJcbiAgICAgICAgJ19fYXNtJyxcclxuICAgICAgICAnX19hc3N1bWUnLFxyXG4gICAgICAgICdfX2Jhc2VkJyxcclxuICAgICAgICAnX19ib3gnLFxyXG4gICAgICAgICdfX2J1aWx0aW5fYWxpZ25vZicsXHJcbiAgICAgICAgJ19fY2RlY2wnLFxyXG4gICAgICAgICdfX2NscmNhbGwnLFxyXG4gICAgICAgICdfX2RlY2xzcGVjJyxcclxuICAgICAgICAnX19kZWxlZ2F0ZScsXHJcbiAgICAgICAgJ19fZXZlbnQnLFxyXG4gICAgICAgICdfX2V4Y2VwdCcsXHJcbiAgICAgICAgJ19fZmFzdGNhbGwnLFxyXG4gICAgICAgICdfX2ZpbmFsbHknLFxyXG4gICAgICAgICdfX2ZvcmNlaW5saW5lJyxcclxuICAgICAgICAnX19nYycsXHJcbiAgICAgICAgJ19faG9vaycsXHJcbiAgICAgICAgJ19faWRlbnRpZmllcicsXHJcbiAgICAgICAgJ19faWZfZXhpc3RzJyxcclxuICAgICAgICAnX19pZl9ub3RfZXhpc3RzJyxcclxuICAgICAgICAnX19pbmxpbmUnLFxyXG4gICAgICAgICdfX2ludDEyOCcsXHJcbiAgICAgICAgJ19faW50MTYnLFxyXG4gICAgICAgICdfX2ludDMyJyxcclxuICAgICAgICAnX19pbnQ2NCcsXHJcbiAgICAgICAgJ19faW50OCcsXHJcbiAgICAgICAgJ19faW50ZXJmYWNlJyxcclxuICAgICAgICAnX19sZWF2ZScsXHJcbiAgICAgICAgJ19fbTEyOCcsXHJcbiAgICAgICAgJ19fbTEyOGQnLFxyXG4gICAgICAgICdfX20xMjhpJyxcclxuICAgICAgICAnX19tMjU2JyxcclxuICAgICAgICAnX19tMjU2ZCcsXHJcbiAgICAgICAgJ19fbTI1NmknLFxyXG4gICAgICAgICdfX202NCcsXHJcbiAgICAgICAgJ19fbXVsdGlwbGVfaW5oZXJpdGFuY2UnLFxyXG4gICAgICAgICdfX25ld3Nsb3QnLFxyXG4gICAgICAgICdfX25vZ2MnLFxyXG4gICAgICAgICdfX25vb3AnLFxyXG4gICAgICAgICdfX25vdW53aW5kJyxcclxuICAgICAgICAnX19ub3Z0b3JkaXNwJyxcclxuICAgICAgICAnX19wYXNjYWwnLFxyXG4gICAgICAgICdfX3BpbicsXHJcbiAgICAgICAgJ19fcHJhZ21hJyxcclxuICAgICAgICAnX19wcm9wZXJ0eScsXHJcbiAgICAgICAgJ19fcHRyMzInLFxyXG4gICAgICAgICdfX3B0cjY0JyxcclxuICAgICAgICAnX19yYWlzZScsXHJcbiAgICAgICAgJ19fcmVzdHJpY3QnLFxyXG4gICAgICAgICdfX3Jlc3VtZScsXHJcbiAgICAgICAgJ19fc2VhbGVkJyxcclxuICAgICAgICAnX19zaW5nbGVfaW5oZXJpdGFuY2UnLFxyXG4gICAgICAgICdfX3N0ZGNhbGwnLFxyXG4gICAgICAgICdfX3N1cGVyJyxcclxuICAgICAgICAnX190aGlzY2FsbCcsXHJcbiAgICAgICAgJ19fdHJ5JyxcclxuICAgICAgICAnX190cnlfY2FzdCcsXHJcbiAgICAgICAgJ19fdHlwZW9mJyxcclxuICAgICAgICAnX191bmFsaWduZWQnLFxyXG4gICAgICAgICdfX3VuaG9vaycsXHJcbiAgICAgICAgJ19fdXVpZG9mJyxcclxuICAgICAgICAnX192YWx1ZScsXHJcbiAgICAgICAgJ19fdmlydHVhbF9pbmhlcml0YW5jZScsXHJcbiAgICAgICAgJ19fdzY0JyxcclxuICAgICAgICAnX193Y2hhcl90J1xyXG4gICAgXSxcclxuICAgIG9wZXJhdG9yczogW1xyXG4gICAgICAgICc9JywgJz4nLCAnPCcsICchJywgJ34nLCAnPycsICc6JyxcclxuICAgICAgICAnPT0nLCAnPD0nLCAnPj0nLCAnIT0nLCAnJiYnLCAnfHwnLCAnKysnLCAnLS0nLFxyXG4gICAgICAgICcrJywgJy0nLCAnKicsICcvJywgJyYnLCAnfCcsICdeJywgJyUnLCAnPDwnLFxyXG4gICAgICAgICc+PicsICc+Pj4nLCAnKz0nLCAnLT0nLCAnKj0nLCAnLz0nLCAnJj0nLCAnfD0nLFxyXG4gICAgICAgICdePScsICclPScsICc8PD0nLCAnPj49JywgJz4+Pj0nXHJcbiAgICBdLFxyXG4gICAgLy8gd2UgaW5jbHVkZSB0aGVzZSBjb21tb24gcmVndWxhciBleHByZXNzaW9uc1xyXG4gICAgc3ltYm9sczogL1s9Pjwhfj86JnwrXFwtKlxcL1xcXiVdKy8sXHJcbiAgICBlc2NhcGVzOiAvXFxcXCg/OlthYmZucnR2XFxcXFwiJ118eFswLTlBLUZhLWZdezEsNH18dVswLTlBLUZhLWZdezR9fFVbMC05QS1GYS1mXXs4fSkvLFxyXG4gICAgaW50ZWdlcnN1ZmZpeDogLyhsbHxMTHx1fFV8bHxMKT8obGx8TEx8dXxVfGx8TCk/LyxcclxuICAgIGZsb2F0c3VmZml4OiAvW2ZGbExdPy8sXHJcbiAgICBlbmNvZGluZzogL3V8dTh8VXxMLyxcclxuICAgIC8vIFRoZSBtYWluIHRva2VuaXplciBmb3Igb3VyIGxhbmd1YWdlc1xyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICAvLyBDKysgMTEgUmF3IFN0cmluZ1xyXG4gICAgICAgICAgICBbL0BlbmNvZGluZz9SXFxcIig/OihbXiAoKVxcXFxcXHRdKikpXFwoLywgeyB0b2tlbjogJ3N0cmluZy5yYXcuYmVnaW4nLCBuZXh0OiAnQHJhdy4kMScgfV0sXHJcbiAgICAgICAgICAgIC8vIGlkZW50aWZpZXJzIGFuZCBrZXl3b3Jkc1xyXG4gICAgICAgICAgICBbL1thLXpBLVpfXVxcdyovLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6IHsgdG9rZW46ICdrZXl3b3JkLiQwJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnaWRlbnRpZmllcidcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgLy8gd2hpdGVzcGFjZVxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgLy8gW1sgYXR0cmlidXRlcyBdXS5cclxuICAgICAgICAgICAgWy9cXFtcXFsuKlxcXVxcXS8sICdhbm5vdGF0aW9uJ10sXHJcbiAgICAgICAgICAgIFsvXlxccyojaW5jbHVkZS8sIHsgdG9rZW46ICdrZXl3b3JkLmRpcmVjdGl2ZS5pbmNsdWRlJywgbmV4dDogJ0BpbmNsdWRlJyB9XSxcclxuICAgICAgICAgICAgLy8gUHJlcHJvY2Vzc29yIGRpcmVjdGl2ZVxyXG4gICAgICAgICAgICBbL15cXHMqI1xccypcXHcrLywgJ2tleXdvcmQnXSxcclxuICAgICAgICAgICAgLy8gZGVsaW1pdGVycyBhbmQgb3BlcmF0b3JzXHJcbiAgICAgICAgICAgIFsvW3t9KClcXFtcXF1dLywgJ0BicmFja2V0cyddLFxyXG4gICAgICAgICAgICBbL1s8Pl0oPyFAc3ltYm9scykvLCAnQGJyYWNrZXRzJ10sXHJcbiAgICAgICAgICAgIFsvQHN5bWJvbHMvLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BvcGVyYXRvcnMnOiAnZGVsaW1pdGVyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJydcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgLy8gbnVtYmVyc1xyXG4gICAgICAgICAgICBbL1xcZCpcXGQrW2VFXShbXFwtK10/XFxkKyk/KEBmbG9hdHN1ZmZpeCkvLCAnbnVtYmVyLmZsb2F0J10sXHJcbiAgICAgICAgICAgIFsvXFxkKlxcLlxcZCsoW2VFXVtcXC0rXT9cXGQrKT8oQGZsb2F0c3VmZml4KS8sICdudW1iZXIuZmxvYXQnXSxcclxuICAgICAgICAgICAgWy8wW3hYXVswLTlhLWZBLUYnXSpbMC05YS1mQS1GXShAaW50ZWdlcnN1ZmZpeCkvLCAnbnVtYmVyLmhleCddLFxyXG4gICAgICAgICAgICBbLzBbMC03J10qWzAtN10oQGludGVnZXJzdWZmaXgpLywgJ251bWJlci5vY3RhbCddLFxyXG4gICAgICAgICAgICBbLzBbYkJdWzAtMSddKlswLTFdKEBpbnRlZ2Vyc3VmZml4KS8sICdudW1iZXIuYmluYXJ5J10sXHJcbiAgICAgICAgICAgIFsvXFxkW1xcZCddKlxcZChAaW50ZWdlcnN1ZmZpeCkvLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIFsvXFxkKEBpbnRlZ2Vyc3VmZml4KS8sICdudW1iZXInXSxcclxuICAgICAgICAgICAgLy8gZGVsaW1pdGVyOiBhZnRlciBudW1iZXIgYmVjYXVzZSBvZiAuXFxkIGZsb2F0c1xyXG4gICAgICAgICAgICBbL1s7LC5dLywgJ2RlbGltaXRlciddLFxyXG4gICAgICAgICAgICAvLyBzdHJpbmdzXHJcbiAgICAgICAgICAgIFsvXCIoW15cIlxcXFxdfFxcXFwuKSokLywgJ3N0cmluZy5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvXCIvLCAnc3RyaW5nJywgJ0BzdHJpbmcnXSxcclxuICAgICAgICAgICAgLy8gY2hhcmFjdGVyc1xyXG4gICAgICAgICAgICBbLydbXlxcXFwnXScvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvKCcpKEBlc2NhcGVzKSgnKS8sIFsnc3RyaW5nJywgJ3N0cmluZy5lc2NhcGUnLCAnc3RyaW5nJ11dLFxyXG4gICAgICAgICAgICBbLycvLCAnc3RyaW5nLmludmFsaWQnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2hpdGVzcGFjZTogW1xyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvLCAnJ10sXHJcbiAgICAgICAgICAgIFsvXFwvXFwqXFwqKD8hXFwvKS8sICdjb21tZW50LmRvYycsICdAZG9jY29tbWVudCddLFxyXG4gICAgICAgICAgICBbL1xcL1xcKi8sICdjb21tZW50JywgJ0Bjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvXFwvXFwvLiokLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGNvbW1lbnQ6IFtcclxuICAgICAgICAgICAgWy9bXlxcLypdKy8sICdjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvXFwqXFwvLywgJ2NvbW1lbnQnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbL1tcXC8qXS8sICdjb21tZW50J11cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vSWRlbnRpY2FsIGNvcHkgb2YgY29tbWVudCBhYm92ZSwgZXhjZXB0IGZvciB0aGUgYWRkaXRpb24gb2YgLmRvY1xyXG4gICAgICAgIGRvY2NvbW1lbnQ6IFtcclxuICAgICAgICAgICAgWy9bXlxcLypdKy8sICdjb21tZW50LmRvYyddLFxyXG4gICAgICAgICAgICBbL1xcKlxcLy8sICdjb21tZW50LmRvYycsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvW1xcLypdLywgJ2NvbW1lbnQuZG9jJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIHN0cmluZzogW1xyXG4gICAgICAgICAgICBbL1teXFxcXFwiXSsvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvQGVzY2FwZXMvLCAnc3RyaW5nLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL1xcXFwuLywgJ3N0cmluZy5lc2NhcGUuaW52YWxpZCddLFxyXG4gICAgICAgICAgICBbL1wiLywgJ3N0cmluZycsICdAcG9wJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIHJhdzogW1xyXG4gICAgICAgICAgICBbLyguKikoXFwpKSg/OihbXiAoKVxcXFxcXHRdKikpKFxcXCIpLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICckMz09JFMyJzogWydzdHJpbmcucmF3JywgJ3N0cmluZy5yYXcuZW5kJywgJ3N0cmluZy5yYXcuZW5kJywgeyB0b2tlbjogJ3N0cmluZy5yYXcuZW5kJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiBbJ3N0cmluZy5yYXcnLCAnc3RyaW5nLnJhdycsICdzdHJpbmcucmF3JywgJ3N0cmluZy5yYXcnXVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgWy8uKi8sICdzdHJpbmcucmF3J11cclxuICAgICAgICBdLFxyXG4gICAgICAgIGluY2x1ZGU6IFtcclxuICAgICAgICAgICAgWy8oXFxzKikoPCkoW148Pl0qKSg+KS8sIFsnJywgJ2tleXdvcmQuZGlyZWN0aXZlLmluY2x1ZGUuYmVnaW4nLCAnc3RyaW5nLmluY2x1ZGUuaWRlbnRpZmllcicsIHsgdG9rZW46ICdrZXl3b3JkLmRpcmVjdGl2ZS5pbmNsdWRlLmVuZCcsIG5leHQ6ICdAcG9wJyB9XV0sXHJcbiAgICAgICAgICAgIFsvKFxccyopKFwiKShbXlwiXSopKFwiKS8sIFsnJywgJ2tleXdvcmQuZGlyZWN0aXZlLmluY2x1ZGUuYmVnaW4nLCAnc3RyaW5nLmluY2x1ZGUuaWRlbnRpZmllcicsIHsgdG9rZW46ICdrZXl3b3JkLmRpcmVjdGl2ZS5pbmNsdWRlLmVuZCcsIG5leHQ6ICdAcG9wJyB9XV1cclxuICAgICAgICBdXHJcbiAgICB9LFxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9