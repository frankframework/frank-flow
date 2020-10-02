(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[6],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/abap/abap.js":
/*!************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/abap/abap.js ***!
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
    comments: {
        lineComment: '*',
    },
    brackets: [
        ['[', ']'],
        ['(', ')']
    ],
};
var abapKeywords = [
    'abstract', 'add', 'add-corresponding', 'adjacent', 'alias', 'aliases', 'all', 'append', 'appending', 'ascending', 'as', 'assert', 'assign', 'assigned', 'assigning', 'association', 'authority-check',
    'back', 'begin', 'binary', 'block', 'bound', 'break-point', 'by', 'byte',
    'class', 'call', 'cast', 'changing', 'check', 'class-data', 'class-method', 'class-methods', 'clear', 'close', 'cnt', 'collect', 'commit', 'cond', 'character',
    'corresponding', 'communication', 'component', 'compute', 'concatenate', 'condense', 'constants', 'conv', 'count',
    'controls', 'convert', 'create', 'currency',
    'data', 'descending', 'default', 'define', 'deferred', 'delete', 'describe', 'detail', 'display', 'divide', 'divide-corresponding', 'display-mode', 'duplicates',
    'deleting',
    'editor-call', 'end', 'endexec', 'endfunction', 'ending', 'endmodule', 'end-of-definition', 'end-of-page', 'end-of-selection', 'end-test-injection', 'end-test-seam', 'exit-command', 'endclass', 'endmethod', 'endform', 'endinterface',
    'endprovide', 'endselect', 'endtry', 'endwhile', 'enum', 'event', 'events', 'exec', 'exit', 'export',
    'exporting', 'extract', 'exception', 'exceptions',
    'field-symbols', 'field-groups', 'field', 'first', 'fetch', 'fields', 'format', 'frame', 'free', 'from', 'function', 'find', 'for', 'found', 'function-pool',
    'generate', 'get',
    'handle', 'hide', 'hashed',
    'include', 'import', 'importing', 'index', 'infotypes', 'initial', 'initialization',
    'id', 'is', 'in', 'interface', 'interfaces', 'init', 'input', 'insert', 'instance', 'into',
    'key',
    'left-justified', 'leave', 'like', 'line', 'line-count', 'line-size', 'load', 'local', 'log-point', 'length', 'left', 'leading', 'lower',
    'matchcode', 'method', 'mesh', 'message', 'message-id', 'methods', 'modify', 'module', 'move', 'move-corresponding', 'multiply', 'multiply-corresponding', 'match',
    'new', 'new-line', 'new-page', 'new-section', 'next', 'no', 'no-gap', 'no-gaps', 'no-sign', 'no-zero', 'non-unique', 'number',
    'occurrence', 'object', 'obligatory', 'of', 'output', 'overlay', 'optional', 'others', 'occurrences', 'occurs', 'offset', 'options',
    'pack', 'parameters', 'perform', 'places', 'position', 'print-control', 'private', 'program', 'protected', 'provide', 'public', 'put',
    'radiobutton', 'raising', 'ranges', 'receive', 'receiving', 'redefinition', 'reduce', 'reference', 'refresh', 'regex', 'reject', 'results', 'requested',
    'ref', 'replace', 'report', 'reserve', 'restore', 'result', 'return', 'returning', 'right-justified', 'rollback', 'read', 'read-only', 'rp-provide-from-last', 'run',
    'scan', 'screen', 'scroll', 'search', 'select', 'select-options', 'selection-screen', 'stamp', 'source', 'subkey',
    'separated', 'set', 'shift', 'single', 'skip', 'sort', 'sorted', 'split', 'standard', 'stamp', 'starting', 'start-of-selection', 'sum', 'subtract-corresponding', 'statics', 'step', 'stop', 'structure', 'submatches', 'submit', 'subtract', 'summary', 'supplied', 'suppress', 'section', 'syntax-check', 'syntax-trace', 'system-call', 'switch',
    'tables', 'table', 'task', 'testing', 'test-seam', 'test-injection', 'then', 'time', 'times', 'title', 'titlebar', 'to', 'top-of-page', 'trailing', 'transfer', 'transformation', 'translate', 'transporting', 'types', 'type', 'type-pool', 'type-pools',
    'unassign', 'unique', 'uline', 'unpack', 'update', 'upper', 'using',
    'value',
    'when', 'while', 'window', 'write', 'where', 'with', 'work',
    'at', 'case', 'catch', 'continue', 'do', 'elseif', 'else', 'endat', 'endcase', 'enddo', 'endif', 'endloop', 'endon', 'if', 'loop', 'on', 'raise', 'try',
    'abs', 'sign', 'ceil', 'floor', 'trunc', 'frac', 'acos', 'asin', 'atan', 'cos', 'sin', 'tan', 'cosh', 'sinh', 'tanh', 'exp', 'log', 'log10', 'sqrt', 'strlen', 'xstrlen', 'charlen', 'lines', 'numofchar', 'dbmaxlen', 'round', 'rescale', 'nmax', 'nmin', 'cmax', 'cmin', 'boolc', 'boolx', 'xsdbool', 'contains', 'contains_any_of', 'contains_any_not_of', 'matches', 'line_exists', 'ipow', 'char_off', 'count', 'count_any_of', 'count_any_not_of', 'distance', 'condense', 'concat_lines_of', 'escape', 'find', 'find_end', 'find_any_of', 'find_any_not_of', 'insert', 'match', 'repeat', 'replace', 'reverse', 'segment', 'shift_left', 'shift_right', 'substring', 'substring_after', 'substring_from', 'substring_before', 'substring_to', 'to_upper', 'to_lower', 'to_mixed', 'from_mixed', 'translate', 'bit-set', 'line_index',
    'definition', 'implementation', 'public', 'inheriting', 'final'
];
var language = {
    defaultToken: 'invalid',
    ignoreCase: true,
    tokenPostfix: '.abap',
    keywords: abapKeywords,
    typeKeywords: [
        'abap_bool', 'string', 'xstring', 'any', 'clike', 'csequence', 'numeric',
        'xsequence', 'c', 'n', 'i', 'p', 'f', 'd', 't', 'x'
    ],
    operators: [
        '+', '-', '/', '*',
        '=', '<', '>', '<=', '>=', '<>', '><', '=<', '=>',
        'EQ', 'NE', 'GE', 'LE',
        'CS', 'CN', 'CA', 'CO', 'CP', 'NS', 'NA', 'NP',
    ],
    symbols: /[=><!~?&+\-*\/\^%]+/,
    tokenizer: {
        root: [
            [/[a-z_$][\w$]*/, { cases: { '@typeKeywords': 'keyword',
                        '@keywords': 'keyword',
                        '@default': 'identifier' } }],
            { include: '@whitespace' },
            [/[:,.]/, 'delimiter'],
            [/[{}()\[\]]/, '@brackets'],
            [/@symbols/, { cases: { '@operators': 'operator',
                        '@default': '' } }],
            [/'/, { token: 'string', bracket: '@open', next: '@stringquote' }],
            [/\|/, { token: 'string', bracket: '@open', next: '@stringtemplate' }],
            [/\d+/, 'number'],
        ],
        stringtemplate: [
            [/[^\\\|]+/, 'string'],
            [/\\\|/, 'string'],
            [/\|/, { token: 'string', bracket: '@close', next: '@pop' }]
        ],
        stringquote: [
            [/[^\\']+/, 'string'],
            [/'/, { token: 'string', bracket: '@close', next: '@pop' }]
        ],
        whitespace: [
            [/[ \t\r\n]+/, ''],
            [/^\*.*$/, 'comment'],
            [/\".*$/, 'comment'],
        ],
    },
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL2FiYXAvYWJhcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrQkFBK0IsU0FBUztBQUN4QztBQUNBLGtEQUFrRCxFQUFFO0FBQ3BELGFBQWEseUJBQXlCO0FBQ3RDO0FBQ0EsaUJBQWlCO0FBQ2pCLDBCQUEwQixTQUFTO0FBQ25DLHdDQUF3QyxFQUFFO0FBQzFDLG1CQUFtQiwwREFBMEQ7QUFDN0Usb0JBQW9CLDZEQUE2RDtBQUNqRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0JBQW9CLG1EQUFtRDtBQUN2RTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsbURBQW1EO0FBQ3RFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTCIsImZpbGUiOiI2Lm1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5leHBvcnQgdmFyIGNvbmYgPSB7XHJcbiAgICBjb21tZW50czoge1xyXG4gICAgICAgIGxpbmVDb21tZW50OiAnKicsXHJcbiAgICB9LFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICBbJ1snLCAnXSddLFxyXG4gICAgICAgIFsnKCcsICcpJ11cclxuICAgIF0sXHJcbn07XHJcbnZhciBhYmFwS2V5d29yZHMgPSBbXHJcbiAgICAnYWJzdHJhY3QnLCAnYWRkJywgJ2FkZC1jb3JyZXNwb25kaW5nJywgJ2FkamFjZW50JywgJ2FsaWFzJywgJ2FsaWFzZXMnLCAnYWxsJywgJ2FwcGVuZCcsICdhcHBlbmRpbmcnLCAnYXNjZW5kaW5nJywgJ2FzJywgJ2Fzc2VydCcsICdhc3NpZ24nLCAnYXNzaWduZWQnLCAnYXNzaWduaW5nJywgJ2Fzc29jaWF0aW9uJywgJ2F1dGhvcml0eS1jaGVjaycsXHJcbiAgICAnYmFjaycsICdiZWdpbicsICdiaW5hcnknLCAnYmxvY2snLCAnYm91bmQnLCAnYnJlYWstcG9pbnQnLCAnYnknLCAnYnl0ZScsXHJcbiAgICAnY2xhc3MnLCAnY2FsbCcsICdjYXN0JywgJ2NoYW5naW5nJywgJ2NoZWNrJywgJ2NsYXNzLWRhdGEnLCAnY2xhc3MtbWV0aG9kJywgJ2NsYXNzLW1ldGhvZHMnLCAnY2xlYXInLCAnY2xvc2UnLCAnY250JywgJ2NvbGxlY3QnLCAnY29tbWl0JywgJ2NvbmQnLCAnY2hhcmFjdGVyJyxcclxuICAgICdjb3JyZXNwb25kaW5nJywgJ2NvbW11bmljYXRpb24nLCAnY29tcG9uZW50JywgJ2NvbXB1dGUnLCAnY29uY2F0ZW5hdGUnLCAnY29uZGVuc2UnLCAnY29uc3RhbnRzJywgJ2NvbnYnLCAnY291bnQnLFxyXG4gICAgJ2NvbnRyb2xzJywgJ2NvbnZlcnQnLCAnY3JlYXRlJywgJ2N1cnJlbmN5JyxcclxuICAgICdkYXRhJywgJ2Rlc2NlbmRpbmcnLCAnZGVmYXVsdCcsICdkZWZpbmUnLCAnZGVmZXJyZWQnLCAnZGVsZXRlJywgJ2Rlc2NyaWJlJywgJ2RldGFpbCcsICdkaXNwbGF5JywgJ2RpdmlkZScsICdkaXZpZGUtY29ycmVzcG9uZGluZycsICdkaXNwbGF5LW1vZGUnLCAnZHVwbGljYXRlcycsXHJcbiAgICAnZGVsZXRpbmcnLFxyXG4gICAgJ2VkaXRvci1jYWxsJywgJ2VuZCcsICdlbmRleGVjJywgJ2VuZGZ1bmN0aW9uJywgJ2VuZGluZycsICdlbmRtb2R1bGUnLCAnZW5kLW9mLWRlZmluaXRpb24nLCAnZW5kLW9mLXBhZ2UnLCAnZW5kLW9mLXNlbGVjdGlvbicsICdlbmQtdGVzdC1pbmplY3Rpb24nLCAnZW5kLXRlc3Qtc2VhbScsICdleGl0LWNvbW1hbmQnLCAnZW5kY2xhc3MnLCAnZW5kbWV0aG9kJywgJ2VuZGZvcm0nLCAnZW5kaW50ZXJmYWNlJyxcclxuICAgICdlbmRwcm92aWRlJywgJ2VuZHNlbGVjdCcsICdlbmR0cnknLCAnZW5kd2hpbGUnLCAnZW51bScsICdldmVudCcsICdldmVudHMnLCAnZXhlYycsICdleGl0JywgJ2V4cG9ydCcsXHJcbiAgICAnZXhwb3J0aW5nJywgJ2V4dHJhY3QnLCAnZXhjZXB0aW9uJywgJ2V4Y2VwdGlvbnMnLFxyXG4gICAgJ2ZpZWxkLXN5bWJvbHMnLCAnZmllbGQtZ3JvdXBzJywgJ2ZpZWxkJywgJ2ZpcnN0JywgJ2ZldGNoJywgJ2ZpZWxkcycsICdmb3JtYXQnLCAnZnJhbWUnLCAnZnJlZScsICdmcm9tJywgJ2Z1bmN0aW9uJywgJ2ZpbmQnLCAnZm9yJywgJ2ZvdW5kJywgJ2Z1bmN0aW9uLXBvb2wnLFxyXG4gICAgJ2dlbmVyYXRlJywgJ2dldCcsXHJcbiAgICAnaGFuZGxlJywgJ2hpZGUnLCAnaGFzaGVkJyxcclxuICAgICdpbmNsdWRlJywgJ2ltcG9ydCcsICdpbXBvcnRpbmcnLCAnaW5kZXgnLCAnaW5mb3R5cGVzJywgJ2luaXRpYWwnLCAnaW5pdGlhbGl6YXRpb24nLFxyXG4gICAgJ2lkJywgJ2lzJywgJ2luJywgJ2ludGVyZmFjZScsICdpbnRlcmZhY2VzJywgJ2luaXQnLCAnaW5wdXQnLCAnaW5zZXJ0JywgJ2luc3RhbmNlJywgJ2ludG8nLFxyXG4gICAgJ2tleScsXHJcbiAgICAnbGVmdC1qdXN0aWZpZWQnLCAnbGVhdmUnLCAnbGlrZScsICdsaW5lJywgJ2xpbmUtY291bnQnLCAnbGluZS1zaXplJywgJ2xvYWQnLCAnbG9jYWwnLCAnbG9nLXBvaW50JywgJ2xlbmd0aCcsICdsZWZ0JywgJ2xlYWRpbmcnLCAnbG93ZXInLFxyXG4gICAgJ21hdGNoY29kZScsICdtZXRob2QnLCAnbWVzaCcsICdtZXNzYWdlJywgJ21lc3NhZ2UtaWQnLCAnbWV0aG9kcycsICdtb2RpZnknLCAnbW9kdWxlJywgJ21vdmUnLCAnbW92ZS1jb3JyZXNwb25kaW5nJywgJ211bHRpcGx5JywgJ211bHRpcGx5LWNvcnJlc3BvbmRpbmcnLCAnbWF0Y2gnLFxyXG4gICAgJ25ldycsICduZXctbGluZScsICduZXctcGFnZScsICduZXctc2VjdGlvbicsICduZXh0JywgJ25vJywgJ25vLWdhcCcsICduby1nYXBzJywgJ25vLXNpZ24nLCAnbm8temVybycsICdub24tdW5pcXVlJywgJ251bWJlcicsXHJcbiAgICAnb2NjdXJyZW5jZScsICdvYmplY3QnLCAnb2JsaWdhdG9yeScsICdvZicsICdvdXRwdXQnLCAnb3ZlcmxheScsICdvcHRpb25hbCcsICdvdGhlcnMnLCAnb2NjdXJyZW5jZXMnLCAnb2NjdXJzJywgJ29mZnNldCcsICdvcHRpb25zJyxcclxuICAgICdwYWNrJywgJ3BhcmFtZXRlcnMnLCAncGVyZm9ybScsICdwbGFjZXMnLCAncG9zaXRpb24nLCAncHJpbnQtY29udHJvbCcsICdwcml2YXRlJywgJ3Byb2dyYW0nLCAncHJvdGVjdGVkJywgJ3Byb3ZpZGUnLCAncHVibGljJywgJ3B1dCcsXHJcbiAgICAncmFkaW9idXR0b24nLCAncmFpc2luZycsICdyYW5nZXMnLCAncmVjZWl2ZScsICdyZWNlaXZpbmcnLCAncmVkZWZpbml0aW9uJywgJ3JlZHVjZScsICdyZWZlcmVuY2UnLCAncmVmcmVzaCcsICdyZWdleCcsICdyZWplY3QnLCAncmVzdWx0cycsICdyZXF1ZXN0ZWQnLFxyXG4gICAgJ3JlZicsICdyZXBsYWNlJywgJ3JlcG9ydCcsICdyZXNlcnZlJywgJ3Jlc3RvcmUnLCAncmVzdWx0JywgJ3JldHVybicsICdyZXR1cm5pbmcnLCAncmlnaHQtanVzdGlmaWVkJywgJ3JvbGxiYWNrJywgJ3JlYWQnLCAncmVhZC1vbmx5JywgJ3JwLXByb3ZpZGUtZnJvbS1sYXN0JywgJ3J1bicsXHJcbiAgICAnc2NhbicsICdzY3JlZW4nLCAnc2Nyb2xsJywgJ3NlYXJjaCcsICdzZWxlY3QnLCAnc2VsZWN0LW9wdGlvbnMnLCAnc2VsZWN0aW9uLXNjcmVlbicsICdzdGFtcCcsICdzb3VyY2UnLCAnc3Via2V5JyxcclxuICAgICdzZXBhcmF0ZWQnLCAnc2V0JywgJ3NoaWZ0JywgJ3NpbmdsZScsICdza2lwJywgJ3NvcnQnLCAnc29ydGVkJywgJ3NwbGl0JywgJ3N0YW5kYXJkJywgJ3N0YW1wJywgJ3N0YXJ0aW5nJywgJ3N0YXJ0LW9mLXNlbGVjdGlvbicsICdzdW0nLCAnc3VidHJhY3QtY29ycmVzcG9uZGluZycsICdzdGF0aWNzJywgJ3N0ZXAnLCAnc3RvcCcsICdzdHJ1Y3R1cmUnLCAnc3VibWF0Y2hlcycsICdzdWJtaXQnLCAnc3VidHJhY3QnLCAnc3VtbWFyeScsICdzdXBwbGllZCcsICdzdXBwcmVzcycsICdzZWN0aW9uJywgJ3N5bnRheC1jaGVjaycsICdzeW50YXgtdHJhY2UnLCAnc3lzdGVtLWNhbGwnLCAnc3dpdGNoJyxcclxuICAgICd0YWJsZXMnLCAndGFibGUnLCAndGFzaycsICd0ZXN0aW5nJywgJ3Rlc3Qtc2VhbScsICd0ZXN0LWluamVjdGlvbicsICd0aGVuJywgJ3RpbWUnLCAndGltZXMnLCAndGl0bGUnLCAndGl0bGViYXInLCAndG8nLCAndG9wLW9mLXBhZ2UnLCAndHJhaWxpbmcnLCAndHJhbnNmZXInLCAndHJhbnNmb3JtYXRpb24nLCAndHJhbnNsYXRlJywgJ3RyYW5zcG9ydGluZycsICd0eXBlcycsICd0eXBlJywgJ3R5cGUtcG9vbCcsICd0eXBlLXBvb2xzJyxcclxuICAgICd1bmFzc2lnbicsICd1bmlxdWUnLCAndWxpbmUnLCAndW5wYWNrJywgJ3VwZGF0ZScsICd1cHBlcicsICd1c2luZycsXHJcbiAgICAndmFsdWUnLFxyXG4gICAgJ3doZW4nLCAnd2hpbGUnLCAnd2luZG93JywgJ3dyaXRlJywgJ3doZXJlJywgJ3dpdGgnLCAnd29yaycsXHJcbiAgICAnYXQnLCAnY2FzZScsICdjYXRjaCcsICdjb250aW51ZScsICdkbycsICdlbHNlaWYnLCAnZWxzZScsICdlbmRhdCcsICdlbmRjYXNlJywgJ2VuZGRvJywgJ2VuZGlmJywgJ2VuZGxvb3AnLCAnZW5kb24nLCAnaWYnLCAnbG9vcCcsICdvbicsICdyYWlzZScsICd0cnknLFxyXG4gICAgJ2FicycsICdzaWduJywgJ2NlaWwnLCAnZmxvb3InLCAndHJ1bmMnLCAnZnJhYycsICdhY29zJywgJ2FzaW4nLCAnYXRhbicsICdjb3MnLCAnc2luJywgJ3RhbicsICdjb3NoJywgJ3NpbmgnLCAndGFuaCcsICdleHAnLCAnbG9nJywgJ2xvZzEwJywgJ3NxcnQnLCAnc3RybGVuJywgJ3hzdHJsZW4nLCAnY2hhcmxlbicsICdsaW5lcycsICdudW1vZmNoYXInLCAnZGJtYXhsZW4nLCAncm91bmQnLCAncmVzY2FsZScsICdubWF4JywgJ25taW4nLCAnY21heCcsICdjbWluJywgJ2Jvb2xjJywgJ2Jvb2x4JywgJ3hzZGJvb2wnLCAnY29udGFpbnMnLCAnY29udGFpbnNfYW55X29mJywgJ2NvbnRhaW5zX2FueV9ub3Rfb2YnLCAnbWF0Y2hlcycsICdsaW5lX2V4aXN0cycsICdpcG93JywgJ2NoYXJfb2ZmJywgJ2NvdW50JywgJ2NvdW50X2FueV9vZicsICdjb3VudF9hbnlfbm90X29mJywgJ2Rpc3RhbmNlJywgJ2NvbmRlbnNlJywgJ2NvbmNhdF9saW5lc19vZicsICdlc2NhcGUnLCAnZmluZCcsICdmaW5kX2VuZCcsICdmaW5kX2FueV9vZicsICdmaW5kX2FueV9ub3Rfb2YnLCAnaW5zZXJ0JywgJ21hdGNoJywgJ3JlcGVhdCcsICdyZXBsYWNlJywgJ3JldmVyc2UnLCAnc2VnbWVudCcsICdzaGlmdF9sZWZ0JywgJ3NoaWZ0X3JpZ2h0JywgJ3N1YnN0cmluZycsICdzdWJzdHJpbmdfYWZ0ZXInLCAnc3Vic3RyaW5nX2Zyb20nLCAnc3Vic3RyaW5nX2JlZm9yZScsICdzdWJzdHJpbmdfdG8nLCAndG9fdXBwZXInLCAndG9fbG93ZXInLCAndG9fbWl4ZWQnLCAnZnJvbV9taXhlZCcsICd0cmFuc2xhdGUnLCAnYml0LXNldCcsICdsaW5lX2luZGV4JyxcclxuICAgICdkZWZpbml0aW9uJywgJ2ltcGxlbWVudGF0aW9uJywgJ3B1YmxpYycsICdpbmhlcml0aW5nJywgJ2ZpbmFsJ1xyXG5dO1xyXG5leHBvcnQgdmFyIGxhbmd1YWdlID0ge1xyXG4gICAgZGVmYXVsdFRva2VuOiAnaW52YWxpZCcsXHJcbiAgICBpZ25vcmVDYXNlOiB0cnVlLFxyXG4gICAgdG9rZW5Qb3N0Zml4OiAnLmFiYXAnLFxyXG4gICAga2V5d29yZHM6IGFiYXBLZXl3b3JkcyxcclxuICAgIHR5cGVLZXl3b3JkczogW1xyXG4gICAgICAgICdhYmFwX2Jvb2wnLCAnc3RyaW5nJywgJ3hzdHJpbmcnLCAnYW55JywgJ2NsaWtlJywgJ2NzZXF1ZW5jZScsICdudW1lcmljJyxcclxuICAgICAgICAneHNlcXVlbmNlJywgJ2MnLCAnbicsICdpJywgJ3AnLCAnZicsICdkJywgJ3QnLCAneCdcclxuICAgIF0sXHJcbiAgICBvcGVyYXRvcnM6IFtcclxuICAgICAgICAnKycsICctJywgJy8nLCAnKicsXHJcbiAgICAgICAgJz0nLCAnPCcsICc+JywgJzw9JywgJz49JywgJzw+JywgJz48JywgJz08JywgJz0+JyxcclxuICAgICAgICAnRVEnLCAnTkUnLCAnR0UnLCAnTEUnLFxyXG4gICAgICAgICdDUycsICdDTicsICdDQScsICdDTycsICdDUCcsICdOUycsICdOQScsICdOUCcsXHJcbiAgICBdLFxyXG4gICAgc3ltYm9sczogL1s9Pjwhfj8mK1xcLSpcXC9cXF4lXSsvLFxyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICBbL1thLXpfJF1bXFx3JF0qLywgeyBjYXNlczogeyAnQHR5cGVLZXl3b3Jkcyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ2lkZW50aWZpZXInIH0gfV0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B3aGl0ZXNwYWNlJyB9LFxyXG4gICAgICAgICAgICBbL1s6LC5dLywgJ2RlbGltaXRlciddLFxyXG4gICAgICAgICAgICBbL1t7fSgpXFxbXFxdXS8sICdAYnJhY2tldHMnXSxcclxuICAgICAgICAgICAgWy9Ac3ltYm9scy8sIHsgY2FzZXM6IHsgJ0BvcGVyYXRvcnMnOiAnb3BlcmF0b3InLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnJyB9IH1dLFxyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nJywgYnJhY2tldDogJ0BvcGVuJywgbmV4dDogJ0BzdHJpbmdxdW90ZScgfV0sXHJcbiAgICAgICAgICAgIFsvXFx8LywgeyB0b2tlbjogJ3N0cmluZycsIGJyYWNrZXQ6ICdAb3BlbicsIG5leHQ6ICdAc3RyaW5ndGVtcGxhdGUnIH1dLFxyXG4gICAgICAgICAgICBbL1xcZCsvLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzdHJpbmd0ZW1wbGF0ZTogW1xyXG4gICAgICAgICAgICBbL1teXFxcXFxcfF0rLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbL1xcXFxcXHwvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvXFx8LywgeyB0b2tlbjogJ3N0cmluZycsIGJyYWNrZXQ6ICdAY2xvc2UnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIHN0cmluZ3F1b3RlOiBbXHJcbiAgICAgICAgICAgIFsvW15cXFxcJ10rLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nJywgYnJhY2tldDogJ0BjbG9zZScsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2hpdGVzcGFjZTogW1xyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvLCAnJ10sXHJcbiAgICAgICAgICAgIFsvXlxcKi4qJC8sICdjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvXFxcIi4qJC8sICdjb21tZW50J10sXHJcbiAgICAgICAgXSxcclxuICAgIH0sXHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiIn0=