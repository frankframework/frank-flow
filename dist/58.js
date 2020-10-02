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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3RjbC90Y2wuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ2E7QUFDTjtBQUNQO0FBQ0EsV0FBVyxLQUFLO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLHdEQUF3RDtBQUNqRSxTQUFTLFNBQVMsWUFBWSw2QkFBNkI7QUFDM0QsU0FBUztBQUNUO0FBQ0EscUNBQXFDLEdBQUcsaUJBQWlCLElBQUksY0FBYyxFQUFFLGNBQWMsRUFBRTtBQUM3RjtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhCQUE4QjtBQUM5Qiw4Q0FBOEMsOENBQThDO0FBQzVGO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQixFQUFFO0FBQ3ZCLGtDQUFrQyxHQUFHO0FBQ3JDO0FBQ0EsYUFBYSx5QkFBeUI7QUFDdEM7QUFDQSxpQkFBaUI7QUFDakI7QUFDQSw0QkFBNEIsSUFBSSwrQ0FBK0M7QUFDL0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZTtBQUNmO0FBQ0EsbUJBQW1CLDREQUE0RDtBQUMvRSxtQkFBbUIsNERBQTREO0FBQy9FO0FBQ0E7QUFDQSxvQkFBb0IsMENBQTBDO0FBQzlELDRCQUE0QixJQUFJLCtDQUErQztBQUMvRTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIseURBQXlEO0FBQzVFO0FBQ0E7QUFDQSxvQkFBb0IsMENBQTBDO0FBQzlELDRCQUE0QixJQUFJLCtDQUErQztBQUMvRTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIseURBQXlEO0FBQzVFO0FBQ0E7QUFDQTtBQUNBLHdCQUF3Qiw0Q0FBNEM7QUFDcEU7QUFDQTtBQUNBO0FBQ0E7QUFDQSwyQkFBMkIsaUNBQWlDO0FBQzVEO0FBQ0E7QUFDQSxrQkFBa0IsRUFBRTtBQUNwQixnQkFBZ0IsSUFBSSxvQ0FBb0M7QUFDeEQ7QUFDQTtBQUNBLG9CQUFvQiwwQ0FBMEM7QUFDOUQsb0JBQW9CLG1DQUFtQztBQUN2RCxhQUFhO0FBQ2I7QUFDQTtBQUNBLG1CQUFtQixvQ0FBb0M7QUFDdkQsbUJBQW1CLG9DQUFvQztBQUN2RCxxQkFBcUIsOEJBQThCO0FBQ25EO0FBQ0E7QUFDQSIsImZpbGUiOiI1OC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG4ndXNlIHN0cmljdCc7XHJcbmV4cG9ydCB2YXIgY29uZiA9IHtcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgWyd7JywgJ30nXSxcclxuICAgICAgICBbJ1snLCAnXSddLFxyXG4gICAgICAgIFsnKCcsICcpJ11cclxuICAgIF0sXHJcbiAgICBhdXRvQ2xvc2luZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXCInLCBjbG9zZTogJ1wiJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJyB9LFxyXG4gICAgXSxcclxuICAgIHN1cnJvdW5kaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICBdXHJcbn07XHJcbmV4cG9ydCB2YXIgbGFuZ3VhZ2UgPSB7XHJcbiAgICB0b2tlblBvc3RmaXg6ICcudGNsJyxcclxuICAgIHNwZWNpYWxGdW5jdGlvbnM6IFtcclxuICAgICAgICAnc2V0JywgJ3Vuc2V0JywgJ3JlbmFtZScsICd2YXJpYWJsZScsICdwcm9jJywgJ2Nvcm91dGluZScsXHJcbiAgICAgICAgJ2ZvcmVhY2gnLFxyXG4gICAgICAgICdpbmNyJywgJ2FwcGVuZCcsXHJcbiAgICAgICAgJ2xhcHBlbmQnLCAnbGluc2VydCcsICdscmVwbGFjZSdcclxuICAgIF0sXHJcbiAgICBtYWluRnVuY3Rpb25zOiBbXHJcbiAgICAgICAgJ2lmJywgJ3RoZW4nLCAnZWxzZWlmJywgJ2Vsc2UnLCAnY2FzZScsICdzd2l0Y2gnLCAnd2hpbGUnLCAnZm9yJyxcclxuICAgICAgICAnYnJlYWsnLCAnY29udGludWUnLCAncmV0dXJuJyxcclxuICAgICAgICAncGFja2FnZScsICduYW1lc3BhY2UnLFxyXG4gICAgICAgICdjYXRjaCcsICdleGl0JyxcclxuICAgICAgICAnZXZhbCcsICdleHByJywgJ3VwbGV2ZWwnLCAndXB2YXInXHJcbiAgICBdLFxyXG4gICAgYnVpbHRpbkZ1bmN0aW9uczogW1xyXG4gICAgICAgICdmaWxlJywgJ2luZm8nLCAnY29uY2F0JywgJ2pvaW4nLCAnbGluZGV4JyxcclxuICAgICAgICAnbGlzdCcsICdsbGVuZ3RoJywgJ2xyYW5nZScsICdsc2VhcmNoJywgJ2xzb3J0JywgJ3NwbGl0JyxcclxuICAgICAgICAnYXJyYXknLCAncGFycmF5JywgJ2JpbmFyeScsICdmb3JtYXQnLCAncmVnZXhwJywgJ3JlZ3N1YicsICdzY2FuJywgJ3N0cmluZycsXHJcbiAgICAgICAgJ3N1YnN0JywgJ2RpY3QnLCAnY2QnLCAnY2xvY2snLCAnZXhlYycsICdnbG9iJywgJ3BpZCcsICdwd2QnLCAnY2xvc2UnLCAnZW9mJywgJ2ZibG9ja2VkJyxcclxuICAgICAgICAnZmNvbmZpZ3VyZScsICdmY29weScsICdmaWxlZXZlbnQnLCAnZmx1c2gnLCAnZ2V0cycsICdvcGVuJywgJ3B1dHMnLCAncmVhZCcsICdzZWVrJyxcclxuICAgICAgICAnc29ja2V0JywgJ3RlbGwnLCAnaW50ZXJwJywgJ2FmdGVyJywgJ2F1dG9fZXhlY29rJyxcclxuICAgICAgICAnYXV0b19sb2FkJywgJ2F1dG9fbWtpbmRleCcsICdhdXRvX3Jlc2V0JywgJ2JnZXJyb3InLCAnZXJyb3InLFxyXG4gICAgICAgICdnbG9iYWwnLCAnaGlzdG9yeScsICdsb2FkJywgJ3NvdXJjZScsICd0aW1lJywgJ3RyYWNlJyxcclxuICAgICAgICAndW5rbm93bicsICd1bnNldCcsICd1cGRhdGUnLCAndndhaXQnLCAnd2luZm8nLCAnd20nLCAnYmluZCcsICdldmVudCcsXHJcbiAgICAgICAgJ3BhY2snLCAncGxhY2UnLCAnZ3JpZCcsICdmb250JywgJ2JlbGwnLCAnY2xpcGJvYXJkJywgJ2Rlc3Ryb3knLCAnZm9jdXMnLCAnZ3JhYicsICdsb3dlcicsXHJcbiAgICAgICAgJ29wdGlvbicsICdyYWlzZScsICdzZWxlY3Rpb24nLCAnc2VuZCcsICd0aycsICd0a3dhaXQnLCAndGtfYmlzcXVlJywgJ3RrX2ZvY3VzTmV4dCcsXHJcbiAgICAgICAgJ3RrX2ZvY3VzUHJldicsICd0a19mb2N1c0ZvbGxvd3NNb3VzZScsICd0a19wb3B1cCcsICd0a19zZXRQYWxldHRlJ1xyXG4gICAgXSxcclxuICAgIHN5bWJvbHM6IC9bPT48IX4/OiZ8K1xcLSpcXC9cXF4lXSsvLFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJywgdG9rZW46ICdkZWxpbWl0ZXIucGFyZW50aGVzaXMnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScsIHRva2VuOiAnZGVsaW1pdGVyLmN1cmx5JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nLCB0b2tlbjogJ2RlbGltaXRlci5zcXVhcmUnIH1cclxuICAgIF0sXHJcbiAgICBlc2NhcGVzOiAvXFxcXCg/OlthYmZucnR2XFxcXFwiJ1xcW1xcXVxce1xcfTtcXCRdfHhbMC05QS1GYS1mXXsxLDR9fHVbMC05QS1GYS1mXXs0fXxVWzAtOUEtRmEtZl17OH0pLyxcclxuICAgIHZhcmlhYmxlczogLyg/OlxcJCsoPzooPzpcXDpcXDo/KT9bYS16QS1aX11cXHcqKSspLyxcclxuICAgIHRva2VuaXplcjoge1xyXG4gICAgICAgIHJvb3Q6IFtcclxuICAgICAgICAgICAgLy8gaWRlbnRpZmllcnMgYW5kIGtleXdvcmRzXHJcbiAgICAgICAgICAgIFsvW2EtekEtWl9dXFx3Ki8sIHsgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BzcGVjaWFsRnVuY3Rpb25zJzogeyB0b2tlbjogJ2tleXdvcmQuZmxvdycsIG5leHQ6ICdAc3BlY2lhbEZ1bmMnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAbWFpbkZ1bmN0aW9ucyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BidWlsdGluRnVuY3Rpb25zJzogJ3ZhcmlhYmxlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ29wZXJhdG9yLnNjc3MnXHJcbiAgICAgICAgICAgICAgICAgICAgfSB9XSxcclxuICAgICAgICAgICAgWy9cXHMrXFwtKyg/IVxcZHxcXC4pXFx3Knx7XFwqfS8sICdtZXRhdGFnJ10sXHJcbiAgICAgICAgICAgIC8vIHdoaXRlc3BhY2VcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHdoaXRlc3BhY2UnIH0sXHJcbiAgICAgICAgICAgIC8vIGRlbGltaXRlcnMgYW5kIG9wZXJhdG9yc1xyXG4gICAgICAgICAgICBbL1t7fSgpXFxbXFxdXS8sICdAYnJhY2tldHMnXSxcclxuICAgICAgICAgICAgWy9Ac3ltYm9scy8sICdvcGVyYXRvciddLFxyXG4gICAgICAgICAgICBbL1xcJCsoPzpcXDpcXDopP1xcey8sIHsgdG9rZW46ICdpZGVudGlmaWVyJywgbmV4dDogJ0BuZXN0ZWRWYXJpYWJsZScgfV0sXHJcbiAgICAgICAgICAgIFsvQHZhcmlhYmxlcy8sICd0eXBlLmlkZW50aWZpZXInXSxcclxuICAgICAgICAgICAgWy9cXC4oPyFcXGR8XFwuKVtcXHdcXC1dKi8sICdvcGVyYXRvci5zcWwnXSxcclxuICAgICAgICAgICAgLy8gbnVtYmVyc1xyXG4gICAgICAgICAgICBbL1xcZCsoXFwuXFxkKyk/LywgJ251bWJlciddLFxyXG4gICAgICAgICAgICBbL1xcZCsvLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIC8vIGRlbGltaXRlclxyXG4gICAgICAgICAgICBbLzsvLCAnZGVsaW1pdGVyJ10sXHJcbiAgICAgICAgICAgIC8vIHN0cmluZ3NcclxuICAgICAgICAgICAgWy9cIi8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBicmFja2V0OiAnQG9wZW4nLCBuZXh0OiAnQGRzdHJpbmcnIH1dLFxyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgYnJhY2tldDogJ0BvcGVuJywgbmV4dDogJ0Bzc3RyaW5nJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgZHN0cmluZzogW1xyXG4gICAgICAgICAgICBbL1xcWy8sIHsgdG9rZW46ICdAYnJhY2tldHMnLCBuZXh0OiAnQG5lc3RlZENhbGwnIH1dLFxyXG4gICAgICAgICAgICBbL1xcJCsoPzpcXDpcXDopP1xcey8sIHsgdG9rZW46ICdpZGVudGlmaWVyJywgbmV4dDogJ0BuZXN0ZWRWYXJpYWJsZScgfV0sXHJcbiAgICAgICAgICAgIFsvQHZhcmlhYmxlcy8sICd0eXBlLmlkZW50aWZpZXInXSxcclxuICAgICAgICAgICAgWy9bXlxcXFwkXFxbXFxdXCJdKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9AZXNjYXBlcy8sICdzdHJpbmcuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvXCIvLCB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgYnJhY2tldDogJ0BjbG9zZScsIG5leHQ6ICdAcG9wJyB9XSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHNzdHJpbmc6IFtcclxuICAgICAgICAgICAgWy9cXFsvLCB7IHRva2VuOiAnQGJyYWNrZXRzJywgbmV4dDogJ0BuZXN0ZWRDYWxsJyB9XSxcclxuICAgICAgICAgICAgWy9cXCQrKD86XFw6XFw6KT9cXHsvLCB7IHRva2VuOiAnaWRlbnRpZmllcicsIG5leHQ6ICdAbmVzdGVkVmFyaWFibGUnIH1dLFxyXG4gICAgICAgICAgICBbL0B2YXJpYWJsZXMvLCAndHlwZS5pZGVudGlmaWVyJ10sXHJcbiAgICAgICAgICAgIFsvW15cXFxcJFxcW1xcXSddKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9AZXNjYXBlcy8sICdzdHJpbmcuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvJy8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBicmFja2V0OiAnQGNsb3NlJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3aGl0ZXNwYWNlOiBbXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy8sICd3aGl0ZSddLFxyXG4gICAgICAgICAgICBbLyMuKlxcXFwkLywgeyB0b2tlbjogJ2NvbW1lbnQnLCBuZXh0OiAnQG5ld2xpbmVDb21tZW50JyB9XSxcclxuICAgICAgICAgICAgWy8jLiooPyFcXFxcKSQvLCAnY29tbWVudCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBuZXdsaW5lQ29tbWVudDogW1xyXG4gICAgICAgICAgICBbLy4qXFxcXCQvLCAnY29tbWVudCddLFxyXG4gICAgICAgICAgICBbLy4qKD8hXFxcXCkkLywgeyB0b2tlbjogJ2NvbW1lbnQnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIG5lc3RlZFZhcmlhYmxlOiBbXHJcbiAgICAgICAgICAgIFsvW15cXHtcXH1cXCRdKy8sICd0eXBlLmlkZW50aWZpZXInXSxcclxuICAgICAgICAgICAgWy9cXH0vLCB7IHRva2VuOiAnaWRlbnRpZmllcicsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbmVzdGVkQ2FsbDogW1xyXG4gICAgICAgICAgICBbL1xcWy8sIHsgdG9rZW46ICdAYnJhY2tldHMnLCBuZXh0OiAnQG5lc3RlZENhbGwnIH1dLFxyXG4gICAgICAgICAgICBbL1xcXS8sIHsgdG9rZW46ICdAYnJhY2tldHMnLCBuZXh0OiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ3Jvb3QnIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIHNwZWNpYWxGdW5jOiBbXHJcbiAgICAgICAgICAgIFsvXCIvLCB7IHRva2VuOiAnc3RyaW5nJywgbmV4dDogJ0Bkc3RyaW5nJyB9XSxcclxuICAgICAgICAgICAgWy8nLywgeyB0b2tlbjogJ3N0cmluZycsIG5leHQ6ICdAc3N0cmluZycgfV0sXHJcbiAgICAgICAgICAgIFsvXFxTKy8sIHsgdG9rZW46ICd0eXBlJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgIF1cclxuICAgIH1cclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIifQ==