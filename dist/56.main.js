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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3N0L3N0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNhO0FBQ047QUFDUDtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSxXQUFXLEtBQUs7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGdEQUFnRDtBQUN6RCxTQUFTLDhDQUE4QztBQUN2RCxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHlDQUF5QztBQUNsRCxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLHNEQUFzRDtBQUMvRCxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLGdEQUFnRDtBQUN6RCxTQUFTLG9EQUFvRDtBQUM3RCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLDBDQUEwQztBQUNuRCxTQUFTO0FBQ1Q7QUFDQTtBQUNBLFNBQVMsU0FBUyxZQUFZLEdBQUc7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyxzREFBc0Q7QUFDL0QsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyxnREFBZ0Q7QUFDekQsU0FBUyxvREFBb0Q7QUFDN0QsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxtQ0FBbUMsWUFBWSxHQUFHO0FBQzNELFNBQVMsd0RBQXdEO0FBQ2pFLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhDQUE4QyxJQUFJLGNBQWMsRUFBRSxjQUFjLEVBQUU7QUFDbEY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlCQUF5QixJQUFJO0FBQzdCO0FBQ0E7QUFDQSxnQkFBZ0I7QUFDaEIscUJBQXFCLHNDQUFzQztBQUMzRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakIsYUFBYSx5QkFBeUI7QUFDdEMsaUJBQWlCO0FBQ2pCO0FBQ0EsbUJBQW1CLDhEQUE4RDtBQUNqRixtQkFBbUIsOERBQThEO0FBQ2pGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5Q0FBeUMsb0NBQW9DO0FBQzdFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQix5REFBeUQ7QUFDNUU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQix5REFBeUQ7QUFDNUU7QUFDQTtBQUNBIiwiZmlsZSI6IjU2Lm1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5leHBvcnQgdmFyIGNvbmYgPSB7XHJcbiAgICBjb21tZW50czoge1xyXG4gICAgICAgIGxpbmVDb21tZW50OiAnLy8nLFxyXG4gICAgICAgIGJsb2NrQ29tbWVudDogWycoKicsICcqKSddLFxyXG4gICAgfSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgWyd7JywgJ30nXSxcclxuICAgICAgICBbJ1snLCAnXSddLFxyXG4gICAgICAgIFsnKCcsICcpJ10sXHJcbiAgICAgICAgWyd2YXInLCAnZW5kX3ZhciddLFxyXG4gICAgICAgIFsndmFyX2lucHV0JywgJ2VuZF92YXInXSxcclxuICAgICAgICBbJ3Zhcl9vdXRwdXQnLCAnZW5kX3ZhciddLFxyXG4gICAgICAgIFsndmFyX2luX291dCcsICdlbmRfdmFyJ10sXHJcbiAgICAgICAgWyd2YXJfdGVtcCcsICdlbmRfdmFyJ10sXHJcbiAgICAgICAgWyd2YXJfZ2xvYmFsJywgJ2VuZF92YXInXSxcclxuICAgICAgICBbJ3Zhcl9hY2Nlc3MnLCAnZW5kX3ZhciddLFxyXG4gICAgICAgIFsndmFyX2V4dGVybmFsJywgJ2VuZF92YXInXSxcclxuICAgICAgICBbJ3R5cGUnLCAnZW5kX3R5cGUnXSxcclxuICAgICAgICBbJ3N0cnVjdCcsICdlbmRfc3RydWN0J10sXHJcbiAgICAgICAgWydwcm9ncmFtJywgJ2VuZF9wcm9ncmFtJ10sXHJcbiAgICAgICAgWydmdW5jdGlvbicsICdlbmRfZnVuY3Rpb24nXSxcclxuICAgICAgICBbJ2Z1bmN0aW9uX2Jsb2NrJywgJ2VuZF9mdW5jdGlvbl9ibG9jayddLFxyXG4gICAgICAgIFsnYWN0aW9uJywgJ2VuZF9hY3Rpb24nXSxcclxuICAgICAgICBbJ3N0ZXAnLCAnZW5kX3N0ZXAnXSxcclxuICAgICAgICBbJ2luaXRpYWxfc3RlcCcsICdlbmRfc3RlcCddLFxyXG4gICAgICAgIFsndHJhbnNhY3Rpb24nLCAnZW5kX3RyYW5zYWN0aW9uJ10sXHJcbiAgICAgICAgWydjb25maWd1cmF0aW9uJywgJ2VuZF9jb25maWd1cmF0aW9uJ10sXHJcbiAgICAgICAgWyd0Y3AnLCAnZW5kX3RjcCddLFxyXG4gICAgICAgIFsncmVjb3VyY2UnLCAnZW5kX3JlY291cmNlJ10sXHJcbiAgICAgICAgWydjaGFubmVsJywgJ2VuZF9jaGFubmVsJ10sXHJcbiAgICAgICAgWydsaWJyYXJ5JywgJ2VuZF9saWJyYXJ5J10sXHJcbiAgICAgICAgWydmb2xkZXInLCAnZW5kX2ZvbGRlciddLFxyXG4gICAgICAgIFsnYmluYXJpZXMnLCAnZW5kX2JpbmFyaWVzJ10sXHJcbiAgICAgICAgWydpbmNsdWRlcycsICdlbmRfaW5jbHVkZXMnXSxcclxuICAgICAgICBbJ3NvdXJjZXMnLCAnZW5kX3NvdXJjZXMnXVxyXG4gICAgXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICcvKicsIGNsb3NlOiAnKi8nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnLCBub3RJbjogWydzdHJpbmdfc3EnXSB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicsIG5vdEluOiBbJ3N0cmluZ19kcSddIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX2lucHV0JywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9vdXRwdXQnLCBjbG9zZTogJ2VuZF92YXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX2luX291dCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd2YXJfdGVtcCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd2YXJfZ2xvYmFsJywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9hY2Nlc3MnLCBjbG9zZTogJ2VuZF92YXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX2V4dGVybmFsJywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3R5cGUnLCBjbG9zZTogJ2VuZF90eXBlJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3N0cnVjdCcsIGNsb3NlOiAnZW5kX3N0cnVjdCcgfSxcclxuICAgICAgICB7IG9wZW46ICdwcm9ncmFtJywgY2xvc2U6ICdlbmRfcHJvZ3JhbScgfSxcclxuICAgICAgICB7IG9wZW46ICdmdW5jdGlvbicsIGNsb3NlOiAnZW5kX2Z1bmN0aW9uJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2Z1bmN0aW9uX2Jsb2NrJywgY2xvc2U6ICdlbmRfZnVuY3Rpb25fYmxvY2snIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnYWN0aW9uJywgY2xvc2U6ICdlbmRfYWN0aW9uJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3N0ZXAnLCBjbG9zZTogJ2VuZF9zdGVwJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2luaXRpYWxfc3RlcCcsIGNsb3NlOiAnZW5kX3N0ZXAnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndHJhbnNhY3Rpb24nLCBjbG9zZTogJ2VuZF90cmFuc2FjdGlvbicgfSxcclxuICAgICAgICB7IG9wZW46ICdjb25maWd1cmF0aW9uJywgY2xvc2U6ICdlbmRfY29uZmlndXJhdGlvbicgfSxcclxuICAgICAgICB7IG9wZW46ICd0Y3AnLCBjbG9zZTogJ2VuZF90Y3AnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAncmVjb3VyY2UnLCBjbG9zZTogJ2VuZF9yZWNvdXJjZScgfSxcclxuICAgICAgICB7IG9wZW46ICdjaGFubmVsJywgY2xvc2U6ICdlbmRfY2hhbm5lbCcgfSxcclxuICAgICAgICB7IG9wZW46ICdsaWJyYXJ5JywgY2xvc2U6ICdlbmRfbGlicmFyeScgfSxcclxuICAgICAgICB7IG9wZW46ICdmb2xkZXInLCBjbG9zZTogJ2VuZF9mb2xkZXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnYmluYXJpZXMnLCBjbG9zZTogJ2VuZF9iaW5hcmllcycgfSxcclxuICAgICAgICB7IG9wZW46ICdpbmNsdWRlcycsIGNsb3NlOiAnZW5kX2luY2x1ZGVzJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3NvdXJjZXMnLCBjbG9zZTogJ2VuZF9zb3VyY2VzJyB9XHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgICAgICB7IG9wZW46ICd2YXInLCBjbG9zZTogJ2VuZF92YXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX2lucHV0JywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9vdXRwdXQnLCBjbG9zZTogJ2VuZF92YXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX2luX291dCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd2YXJfdGVtcCcsIGNsb3NlOiAnZW5kX3ZhcicgfSxcclxuICAgICAgICB7IG9wZW46ICd2YXJfZ2xvYmFsJywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3Zhcl9hY2Nlc3MnLCBjbG9zZTogJ2VuZF92YXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndmFyX2V4dGVybmFsJywgY2xvc2U6ICdlbmRfdmFyJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3R5cGUnLCBjbG9zZTogJ2VuZF90eXBlJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3N0cnVjdCcsIGNsb3NlOiAnZW5kX3N0cnVjdCcgfSxcclxuICAgICAgICB7IG9wZW46ICdwcm9ncmFtJywgY2xvc2U6ICdlbmRfcHJvZ3JhbScgfSxcclxuICAgICAgICB7IG9wZW46ICdmdW5jdGlvbicsIGNsb3NlOiAnZW5kX2Z1bmN0aW9uJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2Z1bmN0aW9uX2Jsb2NrJywgY2xvc2U6ICdlbmRfZnVuY3Rpb25fYmxvY2snIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnYWN0aW9uJywgY2xvc2U6ICdlbmRfYWN0aW9uJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3N0ZXAnLCBjbG9zZTogJ2VuZF9zdGVwJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2luaXRpYWxfc3RlcCcsIGNsb3NlOiAnZW5kX3N0ZXAnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAndHJhbnNhY3Rpb24nLCBjbG9zZTogJ2VuZF90cmFuc2FjdGlvbicgfSxcclxuICAgICAgICB7IG9wZW46ICdjb25maWd1cmF0aW9uJywgY2xvc2U6ICdlbmRfY29uZmlndXJhdGlvbicgfSxcclxuICAgICAgICB7IG9wZW46ICd0Y3AnLCBjbG9zZTogJ2VuZF90Y3AnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAncmVjb3VyY2UnLCBjbG9zZTogJ2VuZF9yZWNvdXJjZScgfSxcclxuICAgICAgICB7IG9wZW46ICdjaGFubmVsJywgY2xvc2U6ICdlbmRfY2hhbm5lbCcgfSxcclxuICAgICAgICB7IG9wZW46ICdsaWJyYXJ5JywgY2xvc2U6ICdlbmRfbGlicmFyeScgfSxcclxuICAgICAgICB7IG9wZW46ICdmb2xkZXInLCBjbG9zZTogJ2VuZF9mb2xkZXInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnYmluYXJpZXMnLCBjbG9zZTogJ2VuZF9iaW5hcmllcycgfSxcclxuICAgICAgICB7IG9wZW46ICdpbmNsdWRlcycsIGNsb3NlOiAnZW5kX2luY2x1ZGVzJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3NvdXJjZXMnLCBjbG9zZTogJ2VuZF9zb3VyY2VzJyB9XHJcbiAgICBdLFxyXG4gICAgZm9sZGluZzoge1xyXG4gICAgICAgIG1hcmtlcnM6IHtcclxuICAgICAgICAgICAgc3RhcnQ6IG5ldyBSZWdFeHAoXCJeXFxcXHMqI3ByYWdtYVxcXFxzK3JlZ2lvblxcXFxiXCIpLFxyXG4gICAgICAgICAgICBlbmQ6IG5ldyBSZWdFeHAoXCJeXFxcXHMqI3ByYWdtYVxcXFxzK2VuZHJlZ2lvblxcXFxiXCIpXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5leHBvcnQgdmFyIGxhbmd1YWdlID0ge1xyXG4gICAgZGVmYXVsdFRva2VuOiAnJyxcclxuICAgIHRva2VuUG9zdGZpeDogJy5zdCcsXHJcbiAgICBpZ25vcmVDYXNlOiB0cnVlLFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICB7IHRva2VuOiAnZGVsaW1pdGVyLmN1cmx5Jywgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyB0b2tlbjogJ2RlbGltaXRlci5wYXJlbnRoZXNpcycsIG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdkZWxpbWl0ZXIuc3F1YXJlJywgb3BlbjogJ1snLCBjbG9zZTogJ10nIH1cclxuICAgIF0sXHJcbiAgICBrZXl3b3JkczogWydpZicsICdlbmRfaWYnLCAnZWxzaWYnLCAnZWxzZScsICdjYXNlJywgJ29mJywgJ3RvJywgJ19fdHJ5JywgJ19fY2F0Y2gnLCAnX19maW5hbGx5JyxcclxuICAgICAgICAnZG8nLCAnd2l0aCcsICdieScsICd3aGlsZScsICdyZXBlYXQnLCAnZW5kX3doaWxlJywgJ2VuZF9yZXBlYXQnLCAnZW5kX2Nhc2UnLFxyXG4gICAgICAgICdmb3InLCAnZW5kX2ZvcicsICd0YXNrJywgJ3JldGFpbicsICdub25fcmV0YWluJywgJ2NvbnN0YW50JywgJ3dpdGgnLCAnYXQnLFxyXG4gICAgICAgICdleGl0JywgJ3JldHVybicsICdpbnRlcnZhbCcsICdwcmlvcml0eScsICdhZGRyZXNzJywgJ3BvcnQnLCAnb25fY2hhbm5lbCcsXHJcbiAgICAgICAgJ3RoZW4nLCAnaWVjJywgJ2ZpbGUnLCAndXNlcycsICd2ZXJzaW9uJywgJ3BhY2thZ2V0eXBlJywgJ2Rpc3BsYXluYW1lJyxcclxuICAgICAgICAnY29weXJpZ2h0JywgJ3N1bW1hcnknLCAndmVuZG9yJywgJ2NvbW1vbl9zb3VyY2UnLCAnZnJvbScsICdleHRlbmRzJ10sXHJcbiAgICBjb25zdGFudDogWydmYWxzZScsICd0cnVlJywgJ251bGwnXSxcclxuICAgIGRlZmluZUtleXdvcmRzOiBbXHJcbiAgICAgICAgJ3ZhcicsICd2YXJfaW5wdXQnLCAndmFyX291dHB1dCcsICd2YXJfaW5fb3V0JywgJ3Zhcl90ZW1wJywgJ3Zhcl9nbG9iYWwnLFxyXG4gICAgICAgICd2YXJfYWNjZXNzJywgJ3Zhcl9leHRlcm5hbCcsICdlbmRfdmFyJyxcclxuICAgICAgICAndHlwZScsICdlbmRfdHlwZScsICdzdHJ1Y3QnLCAnZW5kX3N0cnVjdCcsICdwcm9ncmFtJywgJ2VuZF9wcm9ncmFtJyxcclxuICAgICAgICAnZnVuY3Rpb24nLCAnZW5kX2Z1bmN0aW9uJywgJ2Z1bmN0aW9uX2Jsb2NrJywgJ2VuZF9mdW5jdGlvbl9ibG9jaycsXHJcbiAgICAgICAgJ2ludGVyZmFjZScsICdlbmRfaW50ZXJmYWNlJywgJ21ldGhvZCcsICdlbmRfbWV0aG9kJyxcclxuICAgICAgICAncHJvcGVydHknLCAnZW5kX3Byb3BlcnR5JywgJ25hbWVzcGFjZScsICdlbmRfbmFtZXNwYWNlJyxcclxuICAgICAgICAnY29uZmlndXJhdGlvbicsICdlbmRfY29uZmlndXJhdGlvbicsICd0Y3AnLCAnZW5kX3RjcCcsICdyZXNvdXJjZScsXHJcbiAgICAgICAgJ2VuZF9yZXNvdXJjZScsICdjaGFubmVsJywgJ2VuZF9jaGFubmVsJywgJ2xpYnJhcnknLCAnZW5kX2xpYnJhcnknLFxyXG4gICAgICAgICdmb2xkZXInLCAnZW5kX2ZvbGRlcicsICdiaW5hcmllcycsICdlbmRfYmluYXJpZXMnLCAnaW5jbHVkZXMnLFxyXG4gICAgICAgICdlbmRfaW5jbHVkZXMnLCAnc291cmNlcycsICdlbmRfc291cmNlcycsXHJcbiAgICAgICAgJ2FjdGlvbicsICdlbmRfYWN0aW9uJywgJ3N0ZXAnLCAnaW5pdGlhbF9zdGVwJywgJ2VuZF9zdGVwJywgJ3RyYW5zYWN0aW9uJywgJ2VuZF90cmFuc2FjdGlvbidcclxuICAgIF0sXHJcbiAgICB0eXBlS2V5d29yZHM6IFsnaW50JywgJ3NpbnQnLCAnZGludCcsICdsaW50JywgJ3VzaW50JywgJ3VpbnQnLCAndWRpbnQnLCAndWxpbnQnLFxyXG4gICAgICAgICdyZWFsJywgJ2xyZWFsJywgJ3RpbWUnLCAnZGF0ZScsICd0aW1lX29mX2RheScsICdkYXRlX2FuZF90aW1lJywgJ3N0cmluZycsXHJcbiAgICAgICAgJ2Jvb2wnLCAnYnl0ZScsICd3b3JkJywgJ2R3b3JkJywgJ2FycmF5JywgJ3BvaW50ZXInLCAnbHdvcmQnXSxcclxuICAgIG9wZXJhdG9yczogWyc9JywgJz4nLCAnPCcsICc6JywgJzo9JywgJzw9JywgJz49JywgJzw+JywgJyYnLCAnKycsICctJywgJyonLCAnKionLFxyXG4gICAgICAgICdNT0QnLCAnXicsICdvcicsICdhbmQnLCAnbm90JywgJ3hvcicsICdhYnMnLCAnYWNvcycsICdhc2luJywgJ2F0YW4nLCAnY29zJyxcclxuICAgICAgICAnZXhwJywgJ2V4cHQnLCAnbG4nLCAnbG9nJywgJ3NpbicsICdzcXJ0JywgJ3RhbicsICdzZWwnLCAnbWF4JywgJ21pbicsICdsaW1pdCcsXHJcbiAgICAgICAgJ211eCcsICdzaGwnLCAnc2hyJywgJ3JvbCcsICdyb3InLCAnaW5kZXhvZicsICdzaXplb2YnLCAnYWRyJywgJ2Fkcmluc3QnLFxyXG4gICAgICAgICdiaXRhZHInLCAnaXNfdmFsaWQnLCAncmVmJywgJ3JlZl90byddLFxyXG4gICAgYnVpbHRpblZhcmlhYmxlczogW10sXHJcbiAgICBidWlsdGluRnVuY3Rpb25zOiBbJ3NyJywgJ3JzJywgJ3RwJywgJ3RvbicsICd0b2YnLCAnZXEnLCAnZ2UnLCAnbGUnLCAnbHQnLFxyXG4gICAgICAgICduZScsICdyb3VuZCcsICd0cnVuYycsICdjdGQnLCAn0YF0dScsICdjdHVkJywgJ3JfdHJpZycsICdmX3RyaWcnLFxyXG4gICAgICAgICdtb3ZlJywgJ2NvbmNhdCcsICdkZWxldGUnLCAnZmluZCcsICdpbnNlcnQnLCAnbGVmdCcsICdsZW4nLCAncmVwbGFjZScsXHJcbiAgICAgICAgJ3JpZ2h0JywgJ3J0YyddLFxyXG4gICAgLy8gd2UgaW5jbHVkZSB0aGVzZSBjb21tb24gcmVndWxhciBleHByZXNzaW9uc1xyXG4gICAgc3ltYm9sczogL1s9Pjwhfj86JnwrXFwtKlxcL1xcXiVdKy8sXHJcbiAgICAvLyBDIyBzdHlsZSBzdHJpbmdzXHJcbiAgICBlc2NhcGVzOiAvXFxcXCg/OlthYmZucnR2XFxcXFwiJ118eFswLTlBLUZhLWZdezEsNH18dVswLTlBLUZhLWZdezR9fFVbMC05QS1GYS1mXXs4fSkvLFxyXG4gICAgLy8gVGhlIG1haW4gdG9rZW5pemVyIGZvciBvdXIgbGFuZ3VhZ2VzXHJcbiAgICB0b2tlbml6ZXI6IHtcclxuICAgICAgICByb290OiBbXHJcbiAgICAgICAgICAgIFsvKFxcLlxcLikvLCAnZGVsaW1pdGVyJ10sXHJcbiAgICAgICAgICAgIFsvXFxiKDE2I1swLTlBLUZhLWZcXF9dKikrXFxiLywgJ251bWJlci5oZXgnXSxcclxuICAgICAgICAgICAgWy9cXGIoMiNbMDFcXF9dKykrXFxiLywgJ251bWJlci5iaW5hcnknXSxcclxuICAgICAgICAgICAgWy9cXGIoOCNbMC05XFxfXSopK1xcYi8sICdudW1iZXIub2N0YWwnXSxcclxuICAgICAgICAgICAgWy9cXGJcXGQqXFwuXFxkKyhbZUVdW1xcLStdP1xcZCspP1xcYi8sICdudW1iZXIuZmxvYXQnXSxcclxuICAgICAgICAgICAgWy9cXGIoTD9SRUFMKSNbMC05XFxfXFwuZV0rXFxiLywgJ251bWJlci5mbG9hdCddLFxyXG4gICAgICAgICAgICBbL1xcYihCWVRFfCg/OkR8TCk/V09SRHxVPyg/OlN8RHxMKT9JTlQpI1swLTlcXF9dK1xcYi8sICdudW1iZXInXSxcclxuICAgICAgICAgICAgWy9cXGQrLywgJ251bWJlciddLFxyXG4gICAgICAgICAgICBbL1xcYihUfERUfFRPRCkjWzAtOTotX3NobXlkXStcXGIvLCAndGFnJ10sXHJcbiAgICAgICAgICAgIFsvXFwlKEl8UXxNKShYfEJ8V3xEfEwpWzAtOVxcLl0rLywgJ3RhZyddLFxyXG4gICAgICAgICAgICBbL1xcJShJfFF8TSlbMC05XFwuXSovLCAndGFnJ10sXHJcbiAgICAgICAgICAgIFsvXFxiW0EtWmEtel17MSw2fSNbMC05XStcXGIvLCAndGFnJ10sXHJcbiAgICAgICAgICAgIFsvXFxiKFRPX3xDVFVffENURF98Q1RVRF98TVVYX3xTRUxfKVtBX1phLXpdK1xcYi8sICdwcmVkZWZpbmVkJ10sXHJcbiAgICAgICAgICAgIFsvXFxiW0FfWmEtel0rKF9UT18pW0FfWmEtel0rXFxiLywgJ3ByZWRlZmluZWQnXSxcclxuICAgICAgICAgICAgWy9bO10vLCAnZGVsaW1pdGVyJ10sXHJcbiAgICAgICAgICAgIFsvWy5dLywgeyB0b2tlbjogJ2RlbGltaXRlcicsIG5leHQ6ICdAcGFyYW1zJyB9XSxcclxuICAgICAgICAgICAgLy8gaWRlbnRpZmllcnMgYW5kIGtleXdvcmRzXHJcbiAgICAgICAgICAgIFsvW2EtekEtWl9dXFx3Ki8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQG9wZXJhdG9ycyc6ICdvcGVyYXRvcnMnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogJ2tleXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHR5cGVLZXl3b3Jkcyc6ICd0eXBlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZpbmVLZXl3b3Jkcyc6ICd2YXJpYWJsZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAY29uc3RhbnQnOiAnY29uc3RhbnQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGJ1aWx0aW5WYXJpYWJsZXMnOiAncHJlZGVmaW5lZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAYnVpbHRpbkZ1bmN0aW9ucyc6ICdwcmVkZWZpbmVkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ2lkZW50aWZpZXInXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B3aGl0ZXNwYWNlJyB9LFxyXG4gICAgICAgICAgICBbL1t7fSgpXFxbXFxdXS8sICdAYnJhY2tldHMnXSxcclxuICAgICAgICAgICAgWy9cIihbXlwiXFxcXF18XFxcXC4pKiQvLCAnc3RyaW5nLmludmFsaWQnXSxcclxuICAgICAgICAgICAgWy9cIi8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBicmFja2V0OiAnQG9wZW4nLCBuZXh0OiAnQHN0cmluZ19kcScgfV0sXHJcbiAgICAgICAgICAgIFsvJy8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBicmFja2V0OiAnQG9wZW4nLCBuZXh0OiAnQHN0cmluZ19zcScgfV0sXHJcbiAgICAgICAgICAgIFsvJ1teXFxcXCddJy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy8oJykoQGVzY2FwZXMpKCcpLywgWydzdHJpbmcnLCAnc3RyaW5nLmVzY2FwZScsICdzdHJpbmcnXV0sXHJcbiAgICAgICAgICAgIFsvJy8sICdzdHJpbmcuaW52YWxpZCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBwYXJhbXM6IFtcclxuICAgICAgICAgICAgWy9cXGJbQS1aYS16MC05X10rXFxiKD89XFwoKS8sIHsgdG9rZW46ICdpZGVudGlmaWVyJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbL1xcYltBLVphLXowLTlfXStcXGIvLCAndmFyaWFibGUubmFtZScsICdAcG9wJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIGNvbW1lbnQ6IFtcclxuICAgICAgICAgICAgWy9bXlxcLypdKy8sICdjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvXFwvXFwqLywgJ2NvbW1lbnQnLCAnQHB1c2gnXSxcclxuICAgICAgICAgICAgW1wiXFxcXCovXCIsICdjb21tZW50JywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9bXFwvKl0vLCAnY29tbWVudCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjb21tZW50MjogW1xyXG4gICAgICAgICAgICBbL1teXFwoKl0rLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICAgICAgWy9cXChcXCovLCAnY29tbWVudCcsICdAcHVzaCddLFxyXG4gICAgICAgICAgICBbXCJcXFxcKlxcXFwpXCIsICdjb21tZW50JywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9bXFwoKl0vLCAnY29tbWVudCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3aGl0ZXNwYWNlOiBbXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy8sICd3aGl0ZSddLFxyXG4gICAgICAgICAgICBbL1xcL1xcLy4qJC8sICdjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvXFwvXFwqLywgJ2NvbW1lbnQnLCAnQGNvbW1lbnQnXSxcclxuICAgICAgICAgICAgWy9cXChcXCovLCAnY29tbWVudCcsICdAY29tbWVudDInXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHN0cmluZ19kcTogW1xyXG4gICAgICAgICAgICBbL1teXFxcXFwiXSsvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvQGVzY2FwZXMvLCAnc3RyaW5nLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL1xcXFwuLywgJ3N0cmluZy5lc2NhcGUuaW52YWxpZCddLFxyXG4gICAgICAgICAgICBbL1wiLywgeyB0b2tlbjogJ3N0cmluZy5xdW90ZScsIGJyYWNrZXQ6ICdAY2xvc2UnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIHN0cmluZ19zcTogW1xyXG4gICAgICAgICAgICBbL1teXFxcXCddKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9AZXNjYXBlcy8sICdzdHJpbmcuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXC4vLCAnc3RyaW5nLmVzY2FwZS5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvJy8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBicmFja2V0OiAnQGNsb3NlJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXVxyXG4gICAgfVxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9