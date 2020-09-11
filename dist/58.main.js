(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[58],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/tcl/tcl.js":
/*!**********************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/tcl/tcl.js ***!
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
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
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
    ]
};
var language = {
    tokenPostfix: '.tcl',
    specialFunctions: [
        'set', 'unset', 'rename', 'variable', 'proc', 'coroutine',
        'foreach',
        'incr', 'append',
        'lappend', 'linsert', 'lreplace'
    ],
    mainFunctions: [
        'if', 'then', 'elseif', 'else', 'case', 'switch', 'while', 'for',
        'break', 'continue', 'return',
        'package', 'namespace',
        'catch', 'exit',
        'eval', 'expr', 'uplevel', 'upvar'
    ],
    builtinFunctions: [
        'file', 'info', 'concat', 'join', 'lindex',
        'list', 'llength', 'lrange', 'lsearch', 'lsort', 'split',
        'array', 'parray', 'binary', 'format', 'regexp', 'regsub', 'scan', 'string',
        'subst', 'dict', 'cd', 'clock', 'exec', 'glob', 'pid', 'pwd', 'close', 'eof', 'fblocked',
        'fconfigure', 'fcopy', 'fileevent', 'flush', 'gets', 'open', 'puts', 'read', 'seek',
        'socket', 'tell', 'interp', 'after', 'auto_execok',
        'auto_load', 'auto_mkindex', 'auto_reset', 'bgerror', 'error',
        'global', 'history', 'load', 'source', 'time', 'trace',
        'unknown', 'unset', 'update', 'vwait', 'winfo', 'wm', 'bind', 'event',
        'pack', 'place', 'grid', 'font', 'bell', 'clipboard', 'destroy', 'focus', 'grab', 'lower',
        'option', 'raise', 'selection', 'send', 'tk', 'tkwait', 'tk_bisque', 'tk_focusNext',
        'tk_focusPrev', 'tk_focusFollowsMouse', 'tk_popup', 'tk_setPalette'
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    brackets: [
        { open: '(', close: ')', token: 'delimiter.parenthesis' },
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.square' }
    ],
    escapes: /\\(?:[abfnrtv\\"'\[\]\{\};\$]|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    variables: /(?:\$+(?:(?:\:\:?)?[a-zA-Z_]\w*)+)/,
    tokenizer: {
        root: [
            // identifiers and keywords
            [/[a-zA-Z_]\w*/, { cases: {
                        '@specialFunctions': { token: 'keyword.flow', next: '@specialFunc' },
                        '@mainFunctions': 'keyword',
                        '@builtinFunctions': 'variable',
                        '@default': 'operator.scss'
                    } }],
            [/\s+\-+(?!\d|\.)\w*|{\*}/, 'metatag'],
            // whitespace
            { include: '@whitespace' },
            // delimiters and operators
            [/[{}()\[\]]/, '@brackets'],
            [/@symbols/, 'operator'],
            [/\$+(?:\:\:)?\{/, { token: 'identifier', next: '@nestedVariable' }],
            [/@variables/, 'type.identifier'],
            [/\.(?!\d|\.)[\w\-]*/, 'operator.sql'],
            // numbers
            [/\d+(\.\d+)?/, 'number'],
            [/\d+/, 'number'],
            // delimiter
            [/;/, 'delimiter'],
            // strings
            [/"/, { token: 'string.quote', bracket: '@open', next: '@dstring' }],
            [/'/, { token: 'string.quote', bracket: '@open', next: '@sstring' }]
        ],
        dstring: [
            [/\[/, { token: '@brackets', next: '@nestedCall' }],
            [/\$+(?:\:\:)?\{/, { token: 'identifier', next: '@nestedVariable' }],
            [/@variables/, 'type.identifier'],
            [/[^\\$\[\]"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
        ],
        sstring: [
            [/\[/, { token: '@brackets', next: '@nestedCall' }],
            [/\$+(?:\:\:)?\{/, { token: 'identifier', next: '@nestedVariable' }],
            [/@variables/, 'type.identifier'],
            [/[^\\$\[\]']+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],
        whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/#.*\\$/, { token: 'comment', next: '@newlineComment' }],
            [/#.*(?!\\)$/, 'comment']
        ],
        newlineComment: [
            [/.*\\$/, 'comment'],
            [/.*(?!\\)$/, { token: 'comment', next: '@pop' }]
        ],
        nestedVariable: [
            [/[^\{\}\$]+/, 'type.identifier'],
            [/\}/, { token: 'identifier', next: '@pop' }]
        ],
        nestedCall: [
            [/\[/, { token: '@brackets', next: '@nestedCall' }],
            [/\]/, { token: '@brackets', next: '@pop' }],
            { include: 'root' }
        ],
        specialFunc: [
            [/"/, { token: 'string', next: '@dstring' }],
            [/'/, { token: 'string', next: '@sstring' }],
            [/\S+/, { token: 'type', next: '@pop' }],
        ]
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3RjbC90Y2wuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ2E7QUFDTjtBQUNQO0FBQ0EsV0FBVyxLQUFLO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLHdEQUF3RDtBQUNqRSxTQUFTLFNBQVMsWUFBWSw2QkFBNkI7QUFDM0QsU0FBUztBQUNUO0FBQ0EscUNBQXFDLEdBQUcsaUJBQWlCLElBQUksY0FBYyxFQUFFLGNBQWMsRUFBRTtBQUM3RjtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhCQUE4QjtBQUM5Qiw4Q0FBOEMsOENBQThDO0FBQzVGO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQixFQUFFO0FBQ3ZCLGtDQUFrQyxHQUFHO0FBQ3JDO0FBQ0EsYUFBYSx5QkFBeUI7QUFDdEM7QUFDQSxpQkFBaUI7QUFDakI7QUFDQSw0QkFBNEIsSUFBSSwrQ0FBK0M7QUFDL0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZTtBQUNmO0FBQ0EsbUJBQW1CLDREQUE0RDtBQUMvRSxtQkFBbUIsNERBQTREO0FBQy9FO0FBQ0E7QUFDQSxvQkFBb0IsMENBQTBDO0FBQzlELDRCQUE0QixJQUFJLCtDQUErQztBQUMvRTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIseURBQXlEO0FBQzVFO0FBQ0E7QUFDQSxvQkFBb0IsMENBQTBDO0FBQzlELDRCQUE0QixJQUFJLCtDQUErQztBQUMvRTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIseURBQXlEO0FBQzVFO0FBQ0E7QUFDQTtBQUNBLHdCQUF3Qiw0Q0FBNEM7QUFDcEU7QUFDQTtBQUNBO0FBQ0E7QUFDQSwyQkFBMkIsaUNBQWlDO0FBQzVEO0FBQ0E7QUFDQSxrQkFBa0IsRUFBRTtBQUNwQixnQkFBZ0IsSUFBSSxvQ0FBb0M7QUFDeEQ7QUFDQTtBQUNBLG9CQUFvQiwwQ0FBMEM7QUFDOUQsb0JBQW9CLG1DQUFtQztBQUN2RCxhQUFhO0FBQ2I7QUFDQTtBQUNBLG1CQUFtQixvQ0FBb0M7QUFDdkQsbUJBQW1CLG9DQUFvQztBQUN2RCxxQkFBcUIsOEJBQThCO0FBQ25EO0FBQ0E7QUFDQSIsImZpbGUiOiI1OC5tYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICBbJ3snLCAnfSddLFxyXG4gICAgICAgIFsnWycsICddJ10sXHJcbiAgICAgICAgWycoJywgJyknXVxyXG4gICAgXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgIF1cclxufTtcclxuZXhwb3J0IHZhciBsYW5ndWFnZSA9IHtcclxuICAgIHRva2VuUG9zdGZpeDogJy50Y2wnLFxyXG4gICAgc3BlY2lhbEZ1bmN0aW9uczogW1xyXG4gICAgICAgICdzZXQnLCAndW5zZXQnLCAncmVuYW1lJywgJ3ZhcmlhYmxlJywgJ3Byb2MnLCAnY29yb3V0aW5lJyxcclxuICAgICAgICAnZm9yZWFjaCcsXHJcbiAgICAgICAgJ2luY3InLCAnYXBwZW5kJyxcclxuICAgICAgICAnbGFwcGVuZCcsICdsaW5zZXJ0JywgJ2xyZXBsYWNlJ1xyXG4gICAgXSxcclxuICAgIG1haW5GdW5jdGlvbnM6IFtcclxuICAgICAgICAnaWYnLCAndGhlbicsICdlbHNlaWYnLCAnZWxzZScsICdjYXNlJywgJ3N3aXRjaCcsICd3aGlsZScsICdmb3InLFxyXG4gICAgICAgICdicmVhaycsICdjb250aW51ZScsICdyZXR1cm4nLFxyXG4gICAgICAgICdwYWNrYWdlJywgJ25hbWVzcGFjZScsXHJcbiAgICAgICAgJ2NhdGNoJywgJ2V4aXQnLFxyXG4gICAgICAgICdldmFsJywgJ2V4cHInLCAndXBsZXZlbCcsICd1cHZhcidcclxuICAgIF0sXHJcbiAgICBidWlsdGluRnVuY3Rpb25zOiBbXHJcbiAgICAgICAgJ2ZpbGUnLCAnaW5mbycsICdjb25jYXQnLCAnam9pbicsICdsaW5kZXgnLFxyXG4gICAgICAgICdsaXN0JywgJ2xsZW5ndGgnLCAnbHJhbmdlJywgJ2xzZWFyY2gnLCAnbHNvcnQnLCAnc3BsaXQnLFxyXG4gICAgICAgICdhcnJheScsICdwYXJyYXknLCAnYmluYXJ5JywgJ2Zvcm1hdCcsICdyZWdleHAnLCAncmVnc3ViJywgJ3NjYW4nLCAnc3RyaW5nJyxcclxuICAgICAgICAnc3Vic3QnLCAnZGljdCcsICdjZCcsICdjbG9jaycsICdleGVjJywgJ2dsb2InLCAncGlkJywgJ3B3ZCcsICdjbG9zZScsICdlb2YnLCAnZmJsb2NrZWQnLFxyXG4gICAgICAgICdmY29uZmlndXJlJywgJ2Zjb3B5JywgJ2ZpbGVldmVudCcsICdmbHVzaCcsICdnZXRzJywgJ29wZW4nLCAncHV0cycsICdyZWFkJywgJ3NlZWsnLFxyXG4gICAgICAgICdzb2NrZXQnLCAndGVsbCcsICdpbnRlcnAnLCAnYWZ0ZXInLCAnYXV0b19leGVjb2snLFxyXG4gICAgICAgICdhdXRvX2xvYWQnLCAnYXV0b19ta2luZGV4JywgJ2F1dG9fcmVzZXQnLCAnYmdlcnJvcicsICdlcnJvcicsXHJcbiAgICAgICAgJ2dsb2JhbCcsICdoaXN0b3J5JywgJ2xvYWQnLCAnc291cmNlJywgJ3RpbWUnLCAndHJhY2UnLFxyXG4gICAgICAgICd1bmtub3duJywgJ3Vuc2V0JywgJ3VwZGF0ZScsICd2d2FpdCcsICd3aW5mbycsICd3bScsICdiaW5kJywgJ2V2ZW50JyxcclxuICAgICAgICAncGFjaycsICdwbGFjZScsICdncmlkJywgJ2ZvbnQnLCAnYmVsbCcsICdjbGlwYm9hcmQnLCAnZGVzdHJveScsICdmb2N1cycsICdncmFiJywgJ2xvd2VyJyxcclxuICAgICAgICAnb3B0aW9uJywgJ3JhaXNlJywgJ3NlbGVjdGlvbicsICdzZW5kJywgJ3RrJywgJ3Rrd2FpdCcsICd0a19iaXNxdWUnLCAndGtfZm9jdXNOZXh0JyxcclxuICAgICAgICAndGtfZm9jdXNQcmV2JywgJ3RrX2ZvY3VzRm9sbG93c01vdXNlJywgJ3RrX3BvcHVwJywgJ3RrX3NldFBhbGV0dGUnXHJcbiAgICBdLFxyXG4gICAgc3ltYm9sczogL1s9Pjwhfj86JnwrXFwtKlxcL1xcXiVdKy8sXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknLCB0b2tlbjogJ2RlbGltaXRlci5wYXJlbnRoZXNpcycgfSxcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JywgdG9rZW46ICdkZWxpbWl0ZXIuY3VybHknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScsIHRva2VuOiAnZGVsaW1pdGVyLnNxdWFyZScgfVxyXG4gICAgXSxcclxuICAgIGVzY2FwZXM6IC9cXFxcKD86W2FiZm5ydHZcXFxcXCInXFxbXFxdXFx7XFx9O1xcJF18eFswLTlBLUZhLWZdezEsNH18dVswLTlBLUZhLWZdezR9fFVbMC05QS1GYS1mXXs4fSkvLFxyXG4gICAgdmFyaWFibGVzOiAvKD86XFwkKyg/Oig/OlxcOlxcOj8pP1thLXpBLVpfXVxcdyopKykvLFxyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICAvLyBpZGVudGlmaWVycyBhbmQga2V5d29yZHNcclxuICAgICAgICAgICAgWy9bYS16QS1aX11cXHcqLywgeyBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHNwZWNpYWxGdW5jdGlvbnMnOiB7IHRva2VuOiAna2V5d29yZC5mbG93JywgbmV4dDogJ0BzcGVjaWFsRnVuYycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BtYWluRnVuY3Rpb25zJzogJ2tleXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGJ1aWx0aW5GdW5jdGlvbnMnOiAndmFyaWFibGUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnb3BlcmF0b3Iuc2NzcydcclxuICAgICAgICAgICAgICAgICAgICB9IH1dLFxyXG4gICAgICAgICAgICBbL1xccytcXC0rKD8hXFxkfFxcLilcXHcqfHtcXCp9LywgJ21ldGF0YWcnXSxcclxuICAgICAgICAgICAgLy8gd2hpdGVzcGFjZVxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgLy8gZGVsaW1pdGVycyBhbmQgb3BlcmF0b3JzXHJcbiAgICAgICAgICAgIFsvW3t9KClcXFtcXF1dLywgJ0BicmFja2V0cyddLFxyXG4gICAgICAgICAgICBbL0BzeW1ib2xzLywgJ29wZXJhdG9yJ10sXHJcbiAgICAgICAgICAgIFsvXFwkKyg/OlxcOlxcOik/XFx7LywgeyB0b2tlbjogJ2lkZW50aWZpZXInLCBuZXh0OiAnQG5lc3RlZFZhcmlhYmxlJyB9XSxcclxuICAgICAgICAgICAgWy9AdmFyaWFibGVzLywgJ3R5cGUuaWRlbnRpZmllciddLFxyXG4gICAgICAgICAgICBbL1xcLig/IVxcZHxcXC4pW1xcd1xcLV0qLywgJ29wZXJhdG9yLnNxbCddLFxyXG4gICAgICAgICAgICAvLyBudW1iZXJzXHJcbiAgICAgICAgICAgIFsvXFxkKyhcXC5cXGQrKT8vLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIFsvXFxkKy8sICdudW1iZXInXSxcclxuICAgICAgICAgICAgLy8gZGVsaW1pdGVyXHJcbiAgICAgICAgICAgIFsvOy8sICdkZWxpbWl0ZXInXSxcclxuICAgICAgICAgICAgLy8gc3RyaW5nc1xyXG4gICAgICAgICAgICBbL1wiLywgeyB0b2tlbjogJ3N0cmluZy5xdW90ZScsIGJyYWNrZXQ6ICdAb3BlbicsIG5leHQ6ICdAZHN0cmluZycgfV0sXHJcbiAgICAgICAgICAgIFsvJy8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBicmFja2V0OiAnQG9wZW4nLCBuZXh0OiAnQHNzdHJpbmcnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBkc3RyaW5nOiBbXHJcbiAgICAgICAgICAgIFsvXFxbLywgeyB0b2tlbjogJ0BicmFja2V0cycsIG5leHQ6ICdAbmVzdGVkQ2FsbCcgfV0sXHJcbiAgICAgICAgICAgIFsvXFwkKyg/OlxcOlxcOik/XFx7LywgeyB0b2tlbjogJ2lkZW50aWZpZXInLCBuZXh0OiAnQG5lc3RlZFZhcmlhYmxlJyB9XSxcclxuICAgICAgICAgICAgWy9AdmFyaWFibGVzLywgJ3R5cGUuaWRlbnRpZmllciddLFxyXG4gICAgICAgICAgICBbL1teXFxcXCRcXFtcXF1cIl0rLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbL0Blc2NhcGVzLywgJ3N0cmluZy5lc2NhcGUnXSxcclxuICAgICAgICAgICAgWy9cIi8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBicmFja2V0OiAnQGNsb3NlJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3N0cmluZzogW1xyXG4gICAgICAgICAgICBbL1xcWy8sIHsgdG9rZW46ICdAYnJhY2tldHMnLCBuZXh0OiAnQG5lc3RlZENhbGwnIH1dLFxyXG4gICAgICAgICAgICBbL1xcJCsoPzpcXDpcXDopP1xcey8sIHsgdG9rZW46ICdpZGVudGlmaWVyJywgbmV4dDogJ0BuZXN0ZWRWYXJpYWJsZScgfV0sXHJcbiAgICAgICAgICAgIFsvQHZhcmlhYmxlcy8sICd0eXBlLmlkZW50aWZpZXInXSxcclxuICAgICAgICAgICAgWy9bXlxcXFwkXFxbXFxdJ10rLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbL0Blc2NhcGVzLywgJ3N0cmluZy5lc2NhcGUnXSxcclxuICAgICAgICAgICAgWy8nLywgeyB0b2tlbjogJ3N0cmluZy5xdW90ZScsIGJyYWNrZXQ6ICdAY2xvc2UnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIHdoaXRlc3BhY2U6IFtcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rLywgJ3doaXRlJ10sXHJcbiAgICAgICAgICAgIFsvIy4qXFxcXCQvLCB7IHRva2VuOiAnY29tbWVudCcsIG5leHQ6ICdAbmV3bGluZUNvbW1lbnQnIH1dLFxyXG4gICAgICAgICAgICBbLyMuKig/IVxcXFwpJC8sICdjb21tZW50J11cclxuICAgICAgICBdLFxyXG4gICAgICAgIG5ld2xpbmVDb21tZW50OiBbXHJcbiAgICAgICAgICAgIFsvLipcXFxcJC8sICdjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvLiooPyFcXFxcKSQvLCB7IHRva2VuOiAnY29tbWVudCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbmVzdGVkVmFyaWFibGU6IFtcclxuICAgICAgICAgICAgWy9bXlxce1xcfVxcJF0rLywgJ3R5cGUuaWRlbnRpZmllciddLFxyXG4gICAgICAgICAgICBbL1xcfS8sIHsgdG9rZW46ICdpZGVudGlmaWVyJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBuZXN0ZWRDYWxsOiBbXHJcbiAgICAgICAgICAgIFsvXFxbLywgeyB0b2tlbjogJ0BicmFja2V0cycsIG5leHQ6ICdAbmVzdGVkQ2FsbCcgfV0sXHJcbiAgICAgICAgICAgIFsvXFxdLywgeyB0b2tlbjogJ0BicmFja2V0cycsIG5leHQ6ICdAcG9wJyB9XSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAncm9vdCcgfVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3BlY2lhbEZ1bmM6IFtcclxuICAgICAgICAgICAgWy9cIi8sIHsgdG9rZW46ICdzdHJpbmcnLCBuZXh0OiAnQGRzdHJpbmcnIH1dLFxyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nJywgbmV4dDogJ0Bzc3RyaW5nJyB9XSxcclxuICAgICAgICAgICAgWy9cXFMrLywgeyB0b2tlbjogJ3R5cGUnLCBuZXh0OiAnQHBvcCcgfV0sXHJcbiAgICAgICAgXVxyXG4gICAgfVxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9