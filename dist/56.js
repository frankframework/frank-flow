(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[56],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/st/st.js":
/*!********************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/st/st.js ***!
  \********************************************************************/
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
        blockComment: ['(*', '*)'],
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
        ['var', 'end_var'],
        ['var_input', 'end_var'],
        ['var_output', 'end_var'],
        ['var_in_out', 'end_var'],
        ['var_temp', 'end_var'],
        ['var_global', 'end_var'],
        ['var_access', 'end_var'],
        ['var_external', 'end_var'],
        ['type', 'end_type'],
        ['struct', 'end_struct'],
        ['program', 'end_program'],
        ['function', 'end_function'],
        ['function_block', 'end_function_block'],
        ['action', 'end_action'],
        ['step', 'end_step'],
        ['initial_step', 'end_step'],
        ['transaction', 'end_transaction'],
        ['configuration', 'end_configuration'],
        ['tcp', 'end_tcp'],
        ['recource', 'end_recource'],
        ['channel', 'end_channel'],
        ['library', 'end_library'],
        ['folder', 'end_folder'],
        ['binaries', 'end_binaries'],
        ['includes', 'end_includes'],
        ['sources', 'end_sources']
    ],
    autoClosingPairs: [
        { open: '[', close: ']' },
        { open: '{', close: '}' },
        { open: '(', close: ')' },
        { open: '/*', close: '*/' },
        { open: '\'', close: '\'', notIn: ['string_sq'] },
        { open: '"', close: '"', notIn: ['string_dq'] },
        { open: 'var_input', close: 'end_var' },
        { open: 'var_output', close: 'end_var' },
        { open: 'var_in_out', close: 'end_var' },
        { open: 'var_temp', close: 'end_var' },
        { open: 'var_global', close: 'end_var' },
        { open: 'var_access', close: 'end_var' },
        { open: 'var_external', close: 'end_var' },
        { open: 'type', close: 'end_type' },
        { open: 'struct', close: 'end_struct' },
        { open: 'program', close: 'end_program' },
        { open: 'function', close: 'end_function' },
        { open: 'function_block', close: 'end_function_block' },
        { open: 'action', close: 'end_action' },
        { open: 'step', close: 'end_step' },
        { open: 'initial_step', close: 'end_step' },
        { open: 'transaction', close: 'end_transaction' },
        { open: 'configuration', close: 'end_configuration' },
        { open: 'tcp', close: 'end_tcp' },
        { open: 'recource', close: 'end_recource' },
        { open: 'channel', close: 'end_channel' },
        { open: 'library', close: 'end_library' },
        { open: 'folder', close: 'end_folder' },
        { open: 'binaries', close: 'end_binaries' },
        { open: 'includes', close: 'end_includes' },
        { open: 'sources', close: 'end_sources' }
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: 'var', close: 'end_var' },
        { open: 'var_input', close: 'end_var' },
        { open: 'var_output', close: 'end_var' },
        { open: 'var_in_out', close: 'end_var' },
        { open: 'var_temp', close: 'end_var' },
        { open: 'var_global', close: 'end_var' },
        { open: 'var_access', close: 'end_var' },
        { open: 'var_external', close: 'end_var' },
        { open: 'type', close: 'end_type' },
        { open: 'struct', close: 'end_struct' },
        { open: 'program', close: 'end_program' },
        { open: 'function', close: 'end_function' },
        { open: 'function_block', close: 'end_function_block' },
        { open: 'action', close: 'end_action' },
        { open: 'step', close: 'end_step' },
        { open: 'initial_step', close: 'end_step' },
        { open: 'transaction', close: 'end_transaction' },
        { open: 'configuration', close: 'end_configuration' },
        { open: 'tcp', close: 'end_tcp' },
        { open: 'recource', close: 'end_recource' },
        { open: 'channel', close: 'end_channel' },
        { open: 'library', close: 'end_library' },
        { open: 'folder', close: 'end_folder' },
        { open: 'binaries', close: 'end_binaries' },
        { open: 'includes', close: 'end_includes' },
        { open: 'sources', close: 'end_sources' }
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
    tokenPostfix: '.st',
    ignoreCase: true,
    brackets: [
        { token: 'delimiter.curly', open: '{', close: '}' },
        { token: 'delimiter.parenthesis', open: '(', close: ')' },
        { token: 'delimiter.square', open: '[', close: ']' }
    ],
    keywords: ['if', 'end_if', 'elsif', 'else', 'case', 'of', 'to', '__try', '__catch', '__finally',
        'do', 'with', 'by', 'while', 'repeat', 'end_while', 'end_repeat', 'end_case',
        'for', 'end_for', 'task', 'retain', 'non_retain', 'constant', 'with', 'at',
        'exit', 'return', 'interval', 'priority', 'address', 'port', 'on_channel',
        'then', 'iec', 'file', 'uses', 'version', 'packagetype', 'displayname',
        'copyright', 'summary', 'vendor', 'common_source', 'from', 'extends'],
    constant: ['false', 'true', 'null'],
    defineKeywords: [
        'var', 'var_input', 'var_output', 'var_in_out', 'var_temp', 'var_global',
        'var_access', 'var_external', 'end_var',
        'type', 'end_type', 'struct', 'end_struct', 'program', 'end_program',
        'function', 'end_function', 'function_block', 'end_function_block',
        'interface', 'end_interface', 'method', 'end_method',
        'property', 'end_property', 'namespace', 'end_namespace',
        'configuration', 'end_configuration', 'tcp', 'end_tcp', 'resource',
        'end_resource', 'channel', 'end_channel', 'library', 'end_library',
        'folder', 'end_folder', 'binaries', 'end_binaries', 'includes',
        'end_includes', 'sources', 'end_sources',
        'action', 'end_action', 'step', 'initial_step', 'end_step', 'transaction', 'end_transaction'
    ],
    typeKeywords: ['int', 'sint', 'dint', 'lint', 'usint', 'uint', 'udint', 'ulint',
        'real', 'lreal', 'time', 'date', 'time_of_day', 'date_and_time', 'string',
        'bool', 'byte', 'word', 'dword', 'array', 'pointer', 'lword'],
    operators: ['=', '>', '<', ':', ':=', '<=', '>=', '<>', '&', '+', '-', '*', '**',
        'MOD', '^', 'or', 'and', 'not', 'xor', 'abs', 'acos', 'asin', 'atan', 'cos',
        'exp', 'expt', 'ln', 'log', 'sin', 'sqrt', 'tan', 'sel', 'max', 'min', 'limit',
        'mux', 'shl', 'shr', 'rol', 'ror', 'indexof', 'sizeof', 'adr', 'adrinst',
        'bitadr', 'is_valid', 'ref', 'ref_to'],
    builtinVariables: [],
    builtinFunctions: ['sr', 'rs', 'tp', 'ton', 'tof', 'eq', 'ge', 'le', 'lt',
        'ne', 'round', 'trunc', 'ctd', 'сtu', 'ctud', 'r_trig', 'f_trig',
        'move', 'concat', 'delete', 'find', 'insert', 'left', 'len', 'replace',
        'right', 'rtc'],
    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    // C# style strings
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    // The main tokenizer for our languages
    tokenizer: {
        root: [
            [/(\.\.)/, 'delimiter'],
            [/\b(16#[0-9A-Fa-f\_]*)+\b/, 'number.hex'],
            [/\b(2#[01\_]+)+\b/, 'number.binary'],
            [/\b(8#[0-9\_]*)+\b/, 'number.octal'],
            [/\b\d*\.\d+([eE][\-+]?\d+)?\b/, 'number.float'],
            [/\b(L?REAL)#[0-9\_\.e]+\b/, 'number.float'],
            [/\b(BYTE|(?:D|L)?WORD|U?(?:S|D|L)?INT)#[0-9\_]+\b/, 'number'],
            [/\d+/, 'number'],
            [/\b(T|DT|TOD)#[0-9:-_shmyd]+\b/, 'tag'],
            [/\%(I|Q|M)(X|B|W|D|L)[0-9\.]+/, 'tag'],
            [/\%(I|Q|M)[0-9\.]*/, 'tag'],
            [/\b[A-Za-z]{1,6}#[0-9]+\b/, 'tag'],
            [/\b(TO_|CTU_|CTD_|CTUD_|MUX_|SEL_)[A_Za-z]+\b/, 'predefined'],
            [/\b[A_Za-z]+(_TO_)[A_Za-z]+\b/, 'predefined'],
            [/[;]/, 'delimiter'],
            [/[.]/, { token: 'delimiter', next: '@params' }],
            // identifiers and keywords
            [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@operators': 'operators',
                        '@keywords': 'keyword',
                        '@typeKeywords': 'type',
                        '@defineKeywords': 'variable',
                        '@constant': 'constant',
                        '@builtinVariables': 'predefined',
                        '@builtinFunctions': 'predefined',
                        '@default': 'identifier'
                    }
                }],
            { include: '@whitespace' },
            [/[{}()\[\]]/, '@brackets'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string_dq' }],
            [/'/, { token: 'string.quote', bracket: '@open', next: '@string_sq' }],
            [/'[^\\']'/, 'string'],
            [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
            [/'/, 'string.invalid']
        ],
        params: [
            [/\b[A-Za-z0-9_]+\b(?=\()/, { token: 'identifier', next: '@pop' }],
            [/\b[A-Za-z0-9_]+\b/, 'variable.name', '@pop']
        ],
        comment: [
            [/[^\/*]+/, 'comment'],
            [/\/\*/, 'comment', '@push'],
            ["\\*/", 'comment', '@pop'],
            [/[\/*]/, 'comment']
        ],
        comment2: [
            [/[^\(*]+/, 'comment'],
            [/\(\*/, 'comment', '@push'],
            ["\\*\\)", 'comment', '@pop'],
            [/[\(*]/, 'comment']
        ],
        whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/\/\/.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
            [/\(\*/, 'comment', '@comment2'],
        ],
        string_dq: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],
        string_sq: [
            [/[^\\']+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ]
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3N0L3N0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNhO0FBQ047QUFDUDtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSxXQUFXLEtBQUs7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGdEQUFnRDtBQUN6RCxTQUFTLDhDQUE4QztBQUN2RCxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHlDQUF5QztBQUNsRCxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLHNEQUFzRDtBQUMvRCxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLGdEQUFnRDtBQUN6RCxTQUFTLG9EQUFvRDtBQUM3RCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLDBDQUEwQztBQUNuRCxTQUFTO0FBQ1Q7QUFDQTtBQUNBLFNBQVMsU0FBUyxZQUFZLEdBQUc7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyxzREFBc0Q7QUFDL0QsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyxnREFBZ0Q7QUFDekQsU0FBUyxvREFBb0Q7QUFDN0QsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxtQ0FBbUMsWUFBWSxHQUFHO0FBQzNELFNBQVMsd0RBQXdEO0FBQ2pFLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhDQUE4QyxJQUFJLGNBQWMsRUFBRSxjQUFjLEVBQUU7QUFDbEY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlCQUF5QixJQUFJO0FBQzdCO0FBQ0E7QUFDQSxnQkFBZ0I7QUFDaEIscUJBQXFCLHNDQUFzQztBQUMzRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakIsYUFBYSx5QkFBeUI7QUFDdEMsaUJBQWlCO0FBQ2pCO0FBQ0EsbUJBQW1CLDhEQUE4RDtBQUNqRixtQkFBbUIsOERBQThEO0FBQ2pGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5Q0FBeUMsb0NBQW9DO0FBQzdFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQix5REFBeUQ7QUFDNUU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQix5REFBeUQ7QUFDNUU7QUFDQTtBQUNBIiwiZmlsZSI6IjU2LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBsaW5lQ29tbWVudDogJy8vJyxcclxuICAgICAgICBibG9ja0NvbW1lbnQ6IFsnKConLCAnKiknXSxcclxuICAgIH0sXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIFsneycsICd9J10sXHJcbiAgICAgICAgWydbJywgJ10nXSxcclxuICAgICAgICBbJygnLCAnKSddLFxyXG4gICAgICAgIFsndmFyJywgJ2VuZF92YXInXSxcclxuICAgICAgICBbJ3Zhcl9pbnB1dCcsICdlbmRfdmFyJ10sXHJcbiAgICAgICAgWyd2YXJfb3V0cHV0JywgJ2VuZF92YXInXSxcclxuICAgICAgICBbJ3Zhcl9pbl9vdXQnLCAnZW5kX3ZhciddLFxyXG4gICAgICAgIFsndmFyX3RlbXAnLCAnZW5kX3ZhciddLFxyXG4gICAgICAgIFsndmFyX2dsb2JhbCcsICdlbmRfdmFyJ10sXHJcbiAgICAgICAgWyd2YXJfYWNjZXNzJywgJ2VuZF92YXInXSxcclxuICAgICAgICBbJ3Zhcl9leHRlcm5hbCcsICdlbmRfdmFyJ10sXHJcbiAgICAgICAgWyd0eXBlJywgJ2VuZF90eXBlJ10sXHJcbiAgICAgICAgWydzdHJ1Y3QnLCAnZW5kX3N0cnVjdCddLFxyXG4gICAgICAgIFsncHJvZ3JhbScsICdlbmRfcHJvZ3JhbSddLFxyXG4gICAgICAgIFsnZnVuY3Rpb24nLCAnZW5kX2Z1bmN0aW9uJ10sXHJcbiAgICAgICAgWydmdW5jdGlvbl9ibG9jaycsICdlbmRfZnVuY3Rpb25fYmxvY2snXSxcclxuICAgICAgICBbJ2FjdGlvbicsICdlbmRfYWN0aW9uJ10sXHJcbiAgICAgICAgWydzdGVwJywgJ2VuZF9zdGVwJ10sXHJcbiAgICAgICAgWydpbml0aWFsX3N0ZXAnLCAnZW5kX3N0ZXAnXSxcclxuICAgICAgICBbJ3RyYW5zYWN0aW9uJywgJ2VuZF90cmFuc2FjdGlvbiddLFxyXG4gICAgICAgIFsnY29uZmlndXJhdGlvbicsICdlbmRfY29uZmlndXJhdGlvbiddLFxyXG4gICAgICAgIFsndGNwJywgJ2VuZF90Y3AnXSxcclxuICAgICAgICBbJ3JlY291cmNlJywgJ2VuZF9yZWNvdXJjZSddLFxyXG4gICAgICAgIFsnY2hhbm5lbCcsICdlbmRfY2hhbm5lbCddLFxyXG4gICAgICAgIFsnbGlicmFyeScsICdlbmRfbGlicmFyeSddLFxyXG4gICAgICAgIFsnZm9sZGVyJywgJ2VuZF9mb2xkZXInXSxcclxuICAgICAgICBbJ2JpbmFyaWVzJywgJ2VuZF9iaW5hcmllcyddLFxyXG4gICAgICAgIFsnaW5jbHVkZXMnLCAnZW5kX2luY2x1ZGVzJ10sXHJcbiAgICAgICAgWydzb3VyY2VzJywgJ2VuZF9zb3VyY2VzJ11cclxuICAgIF0sXHJcbiAgICBhdXRvQ2xvc2luZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnLyonLCBjbG9zZTogJyovJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJywgbm90SW46IFsnc3RyaW5nX3NxJ10gfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInLCBub3RJbjogWydzdHJpbmdfZHEnXSB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9pbnB1dCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd2YXJfb3V0cHV0JywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9pbl9vdXQnLCBjbG9zZTogJ2VuZF92YXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX3RlbXAnLCBjbG9zZTogJ2VuZF92YXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX2dsb2JhbCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd2YXJfYWNjZXNzJywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9leHRlcm5hbCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd0eXBlJywgY2xvc2U6ICdlbmRfdHlwZScgfSxcclxuICAgICAgICB7IG9wZW46ICdzdHJ1Y3QnLCBjbG9zZTogJ2VuZF9zdHJ1Y3QnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAncHJvZ3JhbScsIGNsb3NlOiAnZW5kX3Byb2dyYW0nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnZnVuY3Rpb24nLCBjbG9zZTogJ2VuZF9mdW5jdGlvbicgfSxcclxuICAgICAgICB7IG9wZW46ICdmdW5jdGlvbl9ibG9jaycsIGNsb3NlOiAnZW5kX2Z1bmN0aW9uX2Jsb2NrJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2FjdGlvbicsIGNsb3NlOiAnZW5kX2FjdGlvbicgfSxcclxuICAgICAgICB7IG9wZW46ICdzdGVwJywgY2xvc2U6ICdlbmRfc3RlcCcgfSxcclxuICAgICAgICB7IG9wZW46ICdpbml0aWFsX3N0ZXAnLCBjbG9zZTogJ2VuZF9zdGVwJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3RyYW5zYWN0aW9uJywgY2xvc2U6ICdlbmRfdHJhbnNhY3Rpb24nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnY29uZmlndXJhdGlvbicsIGNsb3NlOiAnZW5kX2NvbmZpZ3VyYXRpb24nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndGNwJywgY2xvc2U6ICdlbmRfdGNwJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3JlY291cmNlJywgY2xvc2U6ICdlbmRfcmVjb3VyY2UnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnY2hhbm5lbCcsIGNsb3NlOiAnZW5kX2NoYW5uZWwnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnbGlicmFyeScsIGNsb3NlOiAnZW5kX2xpYnJhcnknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnZm9sZGVyJywgY2xvc2U6ICdlbmRfZm9sZGVyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2JpbmFyaWVzJywgY2xvc2U6ICdlbmRfYmluYXJpZXMnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnaW5jbHVkZXMnLCBjbG9zZTogJ2VuZF9pbmNsdWRlcycgfSxcclxuICAgICAgICB7IG9wZW46ICdzb3VyY2VzJywgY2xvc2U6ICdlbmRfc291cmNlcycgfVxyXG4gICAgXSxcclxuICAgIHN1cnJvdW5kaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyJywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9pbnB1dCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd2YXJfb3V0cHV0JywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9pbl9vdXQnLCBjbG9zZTogJ2VuZF92YXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX3RlbXAnLCBjbG9zZTogJ2VuZF92YXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX2dsb2JhbCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd2YXJfYWNjZXNzJywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9leHRlcm5hbCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd0eXBlJywgY2xvc2U6ICdlbmRfdHlwZScgfSxcclxuICAgICAgICB7IG9wZW46ICdzdHJ1Y3QnLCBjbG9zZTogJ2VuZF9zdHJ1Y3QnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAncHJvZ3JhbScsIGNsb3NlOiAnZW5kX3Byb2dyYW0nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnZnVuY3Rpb24nLCBjbG9zZTogJ2VuZF9mdW5jdGlvbicgfSxcclxuICAgICAgICB7IG9wZW46ICdmdW5jdGlvbl9ibG9jaycsIGNsb3NlOiAnZW5kX2Z1bmN0aW9uX2Jsb2NrJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2FjdGlvbicsIGNsb3NlOiAnZW5kX2FjdGlvbicgfSxcclxuICAgICAgICB7IG9wZW46ICdzdGVwJywgY2xvc2U6ICdlbmRfc3RlcCcgfSxcclxuICAgICAgICB7IG9wZW46ICdpbml0aWFsX3N0ZXAnLCBjbG9zZTogJ2VuZF9zdGVwJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3RyYW5zYWN0aW9uJywgY2xvc2U6ICdlbmRfdHJhbnNhY3Rpb24nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnY29uZmlndXJhdGlvbicsIGNsb3NlOiAnZW5kX2NvbmZpZ3VyYXRpb24nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndGNwJywgY2xvc2U6ICdlbmRfdGNwJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3JlY291cmNlJywgY2xvc2U6ICdlbmRfcmVjb3VyY2UnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnY2hhbm5lbCcsIGNsb3NlOiAnZW5kX2NoYW5uZWwnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnbGlicmFyeScsIGNsb3NlOiAnZW5kX2xpYnJhcnknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnZm9sZGVyJywgY2xvc2U6ICdlbmRfZm9sZGVyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2JpbmFyaWVzJywgY2xvc2U6ICdlbmRfYmluYXJpZXMnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnaW5jbHVkZXMnLCBjbG9zZTogJ2VuZF9pbmNsdWRlcycgfSxcclxuICAgICAgICB7IG9wZW46ICdzb3VyY2VzJywgY2xvc2U6ICdlbmRfc291cmNlcycgfVxyXG4gICAgXSxcclxuICAgIGZvbGRpbmc6IHtcclxuICAgICAgICBtYXJrZXJzOiB7XHJcbiAgICAgICAgICAgIHN0YXJ0OiBuZXcgUmVnRXhwKFwiXlxcXFxzKiNwcmFnbWFcXFxccytyZWdpb25cXFxcYlwiKSxcclxuICAgICAgICAgICAgZW5kOiBuZXcgUmVnRXhwKFwiXlxcXFxzKiNwcmFnbWFcXFxccytlbmRyZWdpb25cXFxcYlwiKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuZXhwb3J0IHZhciBsYW5ndWFnZSA9IHtcclxuICAgIGRlZmF1bHRUb2tlbjogJycsXHJcbiAgICB0b2tlblBvc3RmaXg6ICcuc3QnLFxyXG4gICAgaWdub3JlQ2FzZTogdHJ1ZSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgeyB0b2tlbjogJ2RlbGltaXRlci5jdXJseScsIG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdkZWxpbWl0ZXIucGFyZW50aGVzaXMnLCBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IHRva2VuOiAnZGVsaW1pdGVyLnNxdWFyZScsIG9wZW46ICdbJywgY2xvc2U6ICddJyB9XHJcbiAgICBdLFxyXG4gICAga2V5d29yZHM6IFsnaWYnLCAnZW5kX2lmJywgJ2Vsc2lmJywgJ2Vsc2UnLCAnY2FzZScsICdvZicsICd0bycsICdfX3RyeScsICdfX2NhdGNoJywgJ19fZmluYWxseScsXHJcbiAgICAgICAgJ2RvJywgJ3dpdGgnLCAnYnknLCAnd2hpbGUnLCAncmVwZWF0JywgJ2VuZF93aGlsZScsICdlbmRfcmVwZWF0JywgJ2VuZF9jYXNlJyxcclxuICAgICAgICAnZm9yJywgJ2VuZF9mb3InLCAndGFzaycsICdyZXRhaW4nLCAnbm9uX3JldGFpbicsICdjb25zdGFudCcsICd3aXRoJywgJ2F0JyxcclxuICAgICAgICAnZXhpdCcsICdyZXR1cm4nLCAnaW50ZXJ2YWwnLCAncHJpb3JpdHknLCAnYWRkcmVzcycsICdwb3J0JywgJ29uX2NoYW5uZWwnLFxyXG4gICAgICAgICd0aGVuJywgJ2llYycsICdmaWxlJywgJ3VzZXMnLCAndmVyc2lvbicsICdwYWNrYWdldHlwZScsICdkaXNwbGF5bmFtZScsXHJcbiAgICAgICAgJ2NvcHlyaWdodCcsICdzdW1tYXJ5JywgJ3ZlbmRvcicsICdjb21tb25fc291cmNlJywgJ2Zyb20nLCAnZXh0ZW5kcyddLFxyXG4gICAgY29uc3RhbnQ6IFsnZmFsc2UnLCAndHJ1ZScsICdudWxsJ10sXHJcbiAgICBkZWZpbmVLZXl3b3JkczogW1xyXG4gICAgICAgICd2YXInLCAndmFyX2lucHV0JywgJ3Zhcl9vdXRwdXQnLCAndmFyX2luX291dCcsICd2YXJfdGVtcCcsICd2YXJfZ2xvYmFsJyxcclxuICAgICAgICAndmFyX2FjY2VzcycsICd2YXJfZXh0ZXJuYWwnLCAnZW5kX3ZhcicsXHJcbiAgICAgICAgJ3R5cGUnLCAnZW5kX3R5cGUnLCAnc3RydWN0JywgJ2VuZF9zdHJ1Y3QnLCAncHJvZ3JhbScsICdlbmRfcHJvZ3JhbScsXHJcbiAgICAgICAgJ2Z1bmN0aW9uJywgJ2VuZF9mdW5jdGlvbicsICdmdW5jdGlvbl9ibG9jaycsICdlbmRfZnVuY3Rpb25fYmxvY2snLFxyXG4gICAgICAgICdpbnRlcmZhY2UnLCAnZW5kX2ludGVyZmFjZScsICdtZXRob2QnLCAnZW5kX21ldGhvZCcsXHJcbiAgICAgICAgJ3Byb3BlcnR5JywgJ2VuZF9wcm9wZXJ0eScsICduYW1lc3BhY2UnLCAnZW5kX25hbWVzcGFjZScsXHJcbiAgICAgICAgJ2NvbmZpZ3VyYXRpb24nLCAnZW5kX2NvbmZpZ3VyYXRpb24nLCAndGNwJywgJ2VuZF90Y3AnLCAncmVzb3VyY2UnLFxyXG4gICAgICAgICdlbmRfcmVzb3VyY2UnLCAnY2hhbm5lbCcsICdlbmRfY2hhbm5lbCcsICdsaWJyYXJ5JywgJ2VuZF9saWJyYXJ5JyxcclxuICAgICAgICAnZm9sZGVyJywgJ2VuZF9mb2xkZXInLCAnYmluYXJpZXMnLCAnZW5kX2JpbmFyaWVzJywgJ2luY2x1ZGVzJyxcclxuICAgICAgICAnZW5kX2luY2x1ZGVzJywgJ3NvdXJjZXMnLCAnZW5kX3NvdXJjZXMnLFxyXG4gICAgICAgICdhY3Rpb24nLCAnZW5kX2FjdGlvbicsICdzdGVwJywgJ2luaXRpYWxfc3RlcCcsICdlbmRfc3RlcCcsICd0cmFuc2FjdGlvbicsICdlbmRfdHJhbnNhY3Rpb24nXHJcbiAgICBdLFxyXG4gICAgdHlwZUtleXdvcmRzOiBbJ2ludCcsICdzaW50JywgJ2RpbnQnLCAnbGludCcsICd1c2ludCcsICd1aW50JywgJ3VkaW50JywgJ3VsaW50JyxcclxuICAgICAgICAncmVhbCcsICdscmVhbCcsICd0aW1lJywgJ2RhdGUnLCAndGltZV9vZl9kYXknLCAnZGF0ZV9hbmRfdGltZScsICdzdHJpbmcnLFxyXG4gICAgICAgICdib29sJywgJ2J5dGUnLCAnd29yZCcsICdkd29yZCcsICdhcnJheScsICdwb2ludGVyJywgJ2x3b3JkJ10sXHJcbiAgICBvcGVyYXRvcnM6IFsnPScsICc+JywgJzwnLCAnOicsICc6PScsICc8PScsICc+PScsICc8PicsICcmJywgJysnLCAnLScsICcqJywgJyoqJyxcclxuICAgICAgICAnTU9EJywgJ14nLCAnb3InLCAnYW5kJywgJ25vdCcsICd4b3InLCAnYWJzJywgJ2Fjb3MnLCAnYXNpbicsICdhdGFuJywgJ2NvcycsXHJcbiAgICAgICAgJ2V4cCcsICdleHB0JywgJ2xuJywgJ2xvZycsICdzaW4nLCAnc3FydCcsICd0YW4nLCAnc2VsJywgJ21heCcsICdtaW4nLCAnbGltaXQnLFxyXG4gICAgICAgICdtdXgnLCAnc2hsJywgJ3NocicsICdyb2wnLCAncm9yJywgJ2luZGV4b2YnLCAnc2l6ZW9mJywgJ2FkcicsICdhZHJpbnN0JyxcclxuICAgICAgICAnYml0YWRyJywgJ2lzX3ZhbGlkJywgJ3JlZicsICdyZWZfdG8nXSxcclxuICAgIGJ1aWx0aW5WYXJpYWJsZXM6IFtdLFxyXG4gICAgYnVpbHRpbkZ1bmN0aW9uczogWydzcicsICdycycsICd0cCcsICd0b24nLCAndG9mJywgJ2VxJywgJ2dlJywgJ2xlJywgJ2x0JyxcclxuICAgICAgICAnbmUnLCAncm91bmQnLCAndHJ1bmMnLCAnY3RkJywgJ9GBdHUnLCAnY3R1ZCcsICdyX3RyaWcnLCAnZl90cmlnJyxcclxuICAgICAgICAnbW92ZScsICdjb25jYXQnLCAnZGVsZXRlJywgJ2ZpbmQnLCAnaW5zZXJ0JywgJ2xlZnQnLCAnbGVuJywgJ3JlcGxhY2UnLFxyXG4gICAgICAgICdyaWdodCcsICdydGMnXSxcclxuICAgIC8vIHdlIGluY2x1ZGUgdGhlc2UgY29tbW9uIHJlZ3VsYXIgZXhwcmVzc2lvbnNcclxuICAgIHN5bWJvbHM6IC9bPT48IX4/OiZ8K1xcLSpcXC9cXF4lXSsvLFxyXG4gICAgLy8gQyMgc3R5bGUgc3RyaW5nc1xyXG4gICAgZXNjYXBlczogL1xcXFwoPzpbYWJmbnJ0dlxcXFxcIiddfHhbMC05QS1GYS1mXXsxLDR9fHVbMC05QS1GYS1mXXs0fXxVWzAtOUEtRmEtZl17OH0pLyxcclxuICAgIC8vIFRoZSBtYWluIHRva2VuaXplciBmb3Igb3VyIGxhbmd1YWdlc1xyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICBbLyhcXC5cXC4pLywgJ2RlbGltaXRlciddLFxyXG4gICAgICAgICAgICBbL1xcYigxNiNbMC05QS1GYS1mXFxfXSopK1xcYi8sICdudW1iZXIuaGV4J10sXHJcbiAgICAgICAgICAgIFsvXFxiKDIjWzAxXFxfXSspK1xcYi8sICdudW1iZXIuYmluYXJ5J10sXHJcbiAgICAgICAgICAgIFsvXFxiKDgjWzAtOVxcX10qKStcXGIvLCAnbnVtYmVyLm9jdGFsJ10sXHJcbiAgICAgICAgICAgIFsvXFxiXFxkKlxcLlxcZCsoW2VFXVtcXC0rXT9cXGQrKT9cXGIvLCAnbnVtYmVyLmZsb2F0J10sXHJcbiAgICAgICAgICAgIFsvXFxiKEw/UkVBTCkjWzAtOVxcX1xcLmVdK1xcYi8sICdudW1iZXIuZmxvYXQnXSxcclxuICAgICAgICAgICAgWy9cXGIoQllURXwoPzpEfEwpP1dPUkR8VT8oPzpTfER8TCk/SU5UKSNbMC05XFxfXStcXGIvLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIFsvXFxkKy8sICdudW1iZXInXSxcclxuICAgICAgICAgICAgWy9cXGIoVHxEVHxUT0QpI1swLTk6LV9zaG15ZF0rXFxiLywgJ3RhZyddLFxyXG4gICAgICAgICAgICBbL1xcJShJfFF8TSkoWHxCfFd8RHxMKVswLTlcXC5dKy8sICd0YWcnXSxcclxuICAgICAgICAgICAgWy9cXCUoSXxRfE0pWzAtOVxcLl0qLywgJ3RhZyddLFxyXG4gICAgICAgICAgICBbL1xcYltBLVphLXpdezEsNn0jWzAtOV0rXFxiLywgJ3RhZyddLFxyXG4gICAgICAgICAgICBbL1xcYihUT198Q1RVX3xDVERffENUVURffE1VWF98U0VMXylbQV9aYS16XStcXGIvLCAncHJlZGVmaW5lZCddLFxyXG4gICAgICAgICAgICBbL1xcYltBX1phLXpdKyhfVE9fKVtBX1phLXpdK1xcYi8sICdwcmVkZWZpbmVkJ10sXHJcbiAgICAgICAgICAgIFsvWztdLywgJ2RlbGltaXRlciddLFxyXG4gICAgICAgICAgICBbL1suXS8sIHsgdG9rZW46ICdkZWxpbWl0ZXInLCBuZXh0OiAnQHBhcmFtcycgfV0sXHJcbiAgICAgICAgICAgIC8vIGlkZW50aWZpZXJzIGFuZCBrZXl3b3Jkc1xyXG4gICAgICAgICAgICBbL1thLXpBLVpfXVxcdyovLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BvcGVyYXRvcnMnOiAnb3BlcmF0b3JzJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0B0eXBlS2V5d29yZHMnOiAndHlwZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmaW5lS2V5d29yZHMnOiAndmFyaWFibGUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGNvbnN0YW50JzogJ2NvbnN0YW50JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BidWlsdGluVmFyaWFibGVzJzogJ3ByZWRlZmluZWQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGJ1aWx0aW5GdW5jdGlvbnMnOiAncHJlZGVmaW5lZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgWy9be30oKVxcW1xcXV0vLCAnQGJyYWNrZXRzJ10sXHJcbiAgICAgICAgICAgIFsvXCIoW15cIlxcXFxdfFxcXFwuKSokLywgJ3N0cmluZy5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvXCIvLCB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgYnJhY2tldDogJ0BvcGVuJywgbmV4dDogJ0BzdHJpbmdfZHEnIH1dLFxyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgYnJhY2tldDogJ0BvcGVuJywgbmV4dDogJ0BzdHJpbmdfc3EnIH1dLFxyXG4gICAgICAgICAgICBbLydbXlxcXFwnXScvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvKCcpKEBlc2NhcGVzKSgnKS8sIFsnc3RyaW5nJywgJ3N0cmluZy5lc2NhcGUnLCAnc3RyaW5nJ11dLFxyXG4gICAgICAgICAgICBbLycvLCAnc3RyaW5nLmludmFsaWQnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcGFyYW1zOiBbXHJcbiAgICAgICAgICAgIFsvXFxiW0EtWmEtejAtOV9dK1xcYig/PVxcKCkvLCB7IHRva2VuOiAnaWRlbnRpZmllcicsIG5leHQ6ICdAcG9wJyB9XSxcclxuICAgICAgICAgICAgWy9cXGJbQS1aYS16MC05X10rXFxiLywgJ3ZhcmlhYmxlLm5hbWUnLCAnQHBvcCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjb21tZW50OiBbXHJcbiAgICAgICAgICAgIFsvW15cXC8qXSsvLCAnY29tbWVudCddLFxyXG4gICAgICAgICAgICBbL1xcL1xcKi8sICdjb21tZW50JywgJ0BwdXNoJ10sXHJcbiAgICAgICAgICAgIFtcIlxcXFwqL1wiLCAnY29tbWVudCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvW1xcLypdLywgJ2NvbW1lbnQnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29tbWVudDI6IFtcclxuICAgICAgICAgICAgWy9bXlxcKCpdKy8sICdjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvXFwoXFwqLywgJ2NvbW1lbnQnLCAnQHB1c2gnXSxcclxuICAgICAgICAgICAgW1wiXFxcXCpcXFxcKVwiLCAnY29tbWVudCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvW1xcKCpdLywgJ2NvbW1lbnQnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2hpdGVzcGFjZTogW1xyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvLCAnd2hpdGUnXSxcclxuICAgICAgICAgICAgWy9cXC9cXC8uKiQvLCAnY29tbWVudCddLFxyXG4gICAgICAgICAgICBbL1xcL1xcKi8sICdjb21tZW50JywgJ0Bjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvXFwoXFwqLywgJ2NvbW1lbnQnLCAnQGNvbW1lbnQyJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzdHJpbmdfZHE6IFtcclxuICAgICAgICAgICAgWy9bXlxcXFxcIl0rLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbL0Blc2NhcGVzLywgJ3N0cmluZy5lc2NhcGUnXSxcclxuICAgICAgICAgICAgWy9cXFxcLi8sICdzdHJpbmcuZXNjYXBlLmludmFsaWQnXSxcclxuICAgICAgICAgICAgWy9cIi8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBicmFja2V0OiAnQGNsb3NlJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzdHJpbmdfc3E6IFtcclxuICAgICAgICAgICAgWy9bXlxcXFwnXSsvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvQGVzY2FwZXMvLCAnc3RyaW5nLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL1xcXFwuLywgJ3N0cmluZy5lc2NhcGUuaW52YWxpZCddLFxyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgYnJhY2tldDogJ0BjbG9zZScsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF1cclxuICAgIH1cclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIifQ==