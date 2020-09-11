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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL2FiYXAvYWJhcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrQkFBK0IsU0FBUztBQUN4QztBQUNBLGtEQUFrRCxFQUFFO0FBQ3BELGFBQWEseUJBQXlCO0FBQ3RDO0FBQ0EsaUJBQWlCO0FBQ2pCLDBCQUEwQixTQUFTO0FBQ25DLHdDQUF3QyxFQUFFO0FBQzFDLG1CQUFtQiwwREFBMEQ7QUFDN0Usb0JBQW9CLDZEQUE2RDtBQUNqRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0JBQW9CLG1EQUFtRDtBQUN2RTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsbURBQW1EO0FBQ3RFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTCIsImZpbGUiOiI2LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBsaW5lQ29tbWVudDogJyonLFxyXG4gICAgfSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgWydbJywgJ10nXSxcclxuICAgICAgICBbJygnLCAnKSddXHJcbiAgICBdLFxyXG59O1xyXG52YXIgYWJhcEtleXdvcmRzID0gW1xyXG4gICAgJ2Fic3RyYWN0JywgJ2FkZCcsICdhZGQtY29ycmVzcG9uZGluZycsICdhZGphY2VudCcsICdhbGlhcycsICdhbGlhc2VzJywgJ2FsbCcsICdhcHBlbmQnLCAnYXBwZW5kaW5nJywgJ2FzY2VuZGluZycsICdhcycsICdhc3NlcnQnLCAnYXNzaWduJywgJ2Fzc2lnbmVkJywgJ2Fzc2lnbmluZycsICdhc3NvY2lhdGlvbicsICdhdXRob3JpdHktY2hlY2snLFxyXG4gICAgJ2JhY2snLCAnYmVnaW4nLCAnYmluYXJ5JywgJ2Jsb2NrJywgJ2JvdW5kJywgJ2JyZWFrLXBvaW50JywgJ2J5JywgJ2J5dGUnLFxyXG4gICAgJ2NsYXNzJywgJ2NhbGwnLCAnY2FzdCcsICdjaGFuZ2luZycsICdjaGVjaycsICdjbGFzcy1kYXRhJywgJ2NsYXNzLW1ldGhvZCcsICdjbGFzcy1tZXRob2RzJywgJ2NsZWFyJywgJ2Nsb3NlJywgJ2NudCcsICdjb2xsZWN0JywgJ2NvbW1pdCcsICdjb25kJywgJ2NoYXJhY3RlcicsXHJcbiAgICAnY29ycmVzcG9uZGluZycsICdjb21tdW5pY2F0aW9uJywgJ2NvbXBvbmVudCcsICdjb21wdXRlJywgJ2NvbmNhdGVuYXRlJywgJ2NvbmRlbnNlJywgJ2NvbnN0YW50cycsICdjb252JywgJ2NvdW50JyxcclxuICAgICdjb250cm9scycsICdjb252ZXJ0JywgJ2NyZWF0ZScsICdjdXJyZW5jeScsXHJcbiAgICAnZGF0YScsICdkZXNjZW5kaW5nJywgJ2RlZmF1bHQnLCAnZGVmaW5lJywgJ2RlZmVycmVkJywgJ2RlbGV0ZScsICdkZXNjcmliZScsICdkZXRhaWwnLCAnZGlzcGxheScsICdkaXZpZGUnLCAnZGl2aWRlLWNvcnJlc3BvbmRpbmcnLCAnZGlzcGxheS1tb2RlJywgJ2R1cGxpY2F0ZXMnLFxyXG4gICAgJ2RlbGV0aW5nJyxcclxuICAgICdlZGl0b3ItY2FsbCcsICdlbmQnLCAnZW5kZXhlYycsICdlbmRmdW5jdGlvbicsICdlbmRpbmcnLCAnZW5kbW9kdWxlJywgJ2VuZC1vZi1kZWZpbml0aW9uJywgJ2VuZC1vZi1wYWdlJywgJ2VuZC1vZi1zZWxlY3Rpb24nLCAnZW5kLXRlc3QtaW5qZWN0aW9uJywgJ2VuZC10ZXN0LXNlYW0nLCAnZXhpdC1jb21tYW5kJywgJ2VuZGNsYXNzJywgJ2VuZG1ldGhvZCcsICdlbmRmb3JtJywgJ2VuZGludGVyZmFjZScsXHJcbiAgICAnZW5kcHJvdmlkZScsICdlbmRzZWxlY3QnLCAnZW5kdHJ5JywgJ2VuZHdoaWxlJywgJ2VudW0nLCAnZXZlbnQnLCAnZXZlbnRzJywgJ2V4ZWMnLCAnZXhpdCcsICdleHBvcnQnLFxyXG4gICAgJ2V4cG9ydGluZycsICdleHRyYWN0JywgJ2V4Y2VwdGlvbicsICdleGNlcHRpb25zJyxcclxuICAgICdmaWVsZC1zeW1ib2xzJywgJ2ZpZWxkLWdyb3VwcycsICdmaWVsZCcsICdmaXJzdCcsICdmZXRjaCcsICdmaWVsZHMnLCAnZm9ybWF0JywgJ2ZyYW1lJywgJ2ZyZWUnLCAnZnJvbScsICdmdW5jdGlvbicsICdmaW5kJywgJ2ZvcicsICdmb3VuZCcsICdmdW5jdGlvbi1wb29sJyxcclxuICAgICdnZW5lcmF0ZScsICdnZXQnLFxyXG4gICAgJ2hhbmRsZScsICdoaWRlJywgJ2hhc2hlZCcsXHJcbiAgICAnaW5jbHVkZScsICdpbXBvcnQnLCAnaW1wb3J0aW5nJywgJ2luZGV4JywgJ2luZm90eXBlcycsICdpbml0aWFsJywgJ2luaXRpYWxpemF0aW9uJyxcclxuICAgICdpZCcsICdpcycsICdpbicsICdpbnRlcmZhY2UnLCAnaW50ZXJmYWNlcycsICdpbml0JywgJ2lucHV0JywgJ2luc2VydCcsICdpbnN0YW5jZScsICdpbnRvJyxcclxuICAgICdrZXknLFxyXG4gICAgJ2xlZnQtanVzdGlmaWVkJywgJ2xlYXZlJywgJ2xpa2UnLCAnbGluZScsICdsaW5lLWNvdW50JywgJ2xpbmUtc2l6ZScsICdsb2FkJywgJ2xvY2FsJywgJ2xvZy1wb2ludCcsICdsZW5ndGgnLCAnbGVmdCcsICdsZWFkaW5nJywgJ2xvd2VyJyxcclxuICAgICdtYXRjaGNvZGUnLCAnbWV0aG9kJywgJ21lc2gnLCAnbWVzc2FnZScsICdtZXNzYWdlLWlkJywgJ21ldGhvZHMnLCAnbW9kaWZ5JywgJ21vZHVsZScsICdtb3ZlJywgJ21vdmUtY29ycmVzcG9uZGluZycsICdtdWx0aXBseScsICdtdWx0aXBseS1jb3JyZXNwb25kaW5nJywgJ21hdGNoJyxcclxuICAgICduZXcnLCAnbmV3LWxpbmUnLCAnbmV3LXBhZ2UnLCAnbmV3LXNlY3Rpb24nLCAnbmV4dCcsICdubycsICduby1nYXAnLCAnbm8tZ2FwcycsICduby1zaWduJywgJ25vLXplcm8nLCAnbm9uLXVuaXF1ZScsICdudW1iZXInLFxyXG4gICAgJ29jY3VycmVuY2UnLCAnb2JqZWN0JywgJ29ibGlnYXRvcnknLCAnb2YnLCAnb3V0cHV0JywgJ292ZXJsYXknLCAnb3B0aW9uYWwnLCAnb3RoZXJzJywgJ29jY3VycmVuY2VzJywgJ29jY3VycycsICdvZmZzZXQnLCAnb3B0aW9ucycsXHJcbiAgICAncGFjaycsICdwYXJhbWV0ZXJzJywgJ3BlcmZvcm0nLCAncGxhY2VzJywgJ3Bvc2l0aW9uJywgJ3ByaW50LWNvbnRyb2wnLCAncHJpdmF0ZScsICdwcm9ncmFtJywgJ3Byb3RlY3RlZCcsICdwcm92aWRlJywgJ3B1YmxpYycsICdwdXQnLFxyXG4gICAgJ3JhZGlvYnV0dG9uJywgJ3JhaXNpbmcnLCAncmFuZ2VzJywgJ3JlY2VpdmUnLCAncmVjZWl2aW5nJywgJ3JlZGVmaW5pdGlvbicsICdyZWR1Y2UnLCAncmVmZXJlbmNlJywgJ3JlZnJlc2gnLCAncmVnZXgnLCAncmVqZWN0JywgJ3Jlc3VsdHMnLCAncmVxdWVzdGVkJyxcclxuICAgICdyZWYnLCAncmVwbGFjZScsICdyZXBvcnQnLCAncmVzZXJ2ZScsICdyZXN0b3JlJywgJ3Jlc3VsdCcsICdyZXR1cm4nLCAncmV0dXJuaW5nJywgJ3JpZ2h0LWp1c3RpZmllZCcsICdyb2xsYmFjaycsICdyZWFkJywgJ3JlYWQtb25seScsICdycC1wcm92aWRlLWZyb20tbGFzdCcsICdydW4nLFxyXG4gICAgJ3NjYW4nLCAnc2NyZWVuJywgJ3Njcm9sbCcsICdzZWFyY2gnLCAnc2VsZWN0JywgJ3NlbGVjdC1vcHRpb25zJywgJ3NlbGVjdGlvbi1zY3JlZW4nLCAnc3RhbXAnLCAnc291cmNlJywgJ3N1YmtleScsXHJcbiAgICAnc2VwYXJhdGVkJywgJ3NldCcsICdzaGlmdCcsICdzaW5nbGUnLCAnc2tpcCcsICdzb3J0JywgJ3NvcnRlZCcsICdzcGxpdCcsICdzdGFuZGFyZCcsICdzdGFtcCcsICdzdGFydGluZycsICdzdGFydC1vZi1zZWxlY3Rpb24nLCAnc3VtJywgJ3N1YnRyYWN0LWNvcnJlc3BvbmRpbmcnLCAnc3RhdGljcycsICdzdGVwJywgJ3N0b3AnLCAnc3RydWN0dXJlJywgJ3N1Ym1hdGNoZXMnLCAnc3VibWl0JywgJ3N1YnRyYWN0JywgJ3N1bW1hcnknLCAnc3VwcGxpZWQnLCAnc3VwcHJlc3MnLCAnc2VjdGlvbicsICdzeW50YXgtY2hlY2snLCAnc3ludGF4LXRyYWNlJywgJ3N5c3RlbS1jYWxsJywgJ3N3aXRjaCcsXHJcbiAgICAndGFibGVzJywgJ3RhYmxlJywgJ3Rhc2snLCAndGVzdGluZycsICd0ZXN0LXNlYW0nLCAndGVzdC1pbmplY3Rpb24nLCAndGhlbicsICd0aW1lJywgJ3RpbWVzJywgJ3RpdGxlJywgJ3RpdGxlYmFyJywgJ3RvJywgJ3RvcC1vZi1wYWdlJywgJ3RyYWlsaW5nJywgJ3RyYW5zZmVyJywgJ3RyYW5zZm9ybWF0aW9uJywgJ3RyYW5zbGF0ZScsICd0cmFuc3BvcnRpbmcnLCAndHlwZXMnLCAndHlwZScsICd0eXBlLXBvb2wnLCAndHlwZS1wb29scycsXHJcbiAgICAndW5hc3NpZ24nLCAndW5pcXVlJywgJ3VsaW5lJywgJ3VucGFjaycsICd1cGRhdGUnLCAndXBwZXInLCAndXNpbmcnLFxyXG4gICAgJ3ZhbHVlJyxcclxuICAgICd3aGVuJywgJ3doaWxlJywgJ3dpbmRvdycsICd3cml0ZScsICd3aGVyZScsICd3aXRoJywgJ3dvcmsnLFxyXG4gICAgJ2F0JywgJ2Nhc2UnLCAnY2F0Y2gnLCAnY29udGludWUnLCAnZG8nLCAnZWxzZWlmJywgJ2Vsc2UnLCAnZW5kYXQnLCAnZW5kY2FzZScsICdlbmRkbycsICdlbmRpZicsICdlbmRsb29wJywgJ2VuZG9uJywgJ2lmJywgJ2xvb3AnLCAnb24nLCAncmFpc2UnLCAndHJ5JyxcclxuICAgICdhYnMnLCAnc2lnbicsICdjZWlsJywgJ2Zsb29yJywgJ3RydW5jJywgJ2ZyYWMnLCAnYWNvcycsICdhc2luJywgJ2F0YW4nLCAnY29zJywgJ3NpbicsICd0YW4nLCAnY29zaCcsICdzaW5oJywgJ3RhbmgnLCAnZXhwJywgJ2xvZycsICdsb2cxMCcsICdzcXJ0JywgJ3N0cmxlbicsICd4c3RybGVuJywgJ2NoYXJsZW4nLCAnbGluZXMnLCAnbnVtb2ZjaGFyJywgJ2RibWF4bGVuJywgJ3JvdW5kJywgJ3Jlc2NhbGUnLCAnbm1heCcsICdubWluJywgJ2NtYXgnLCAnY21pbicsICdib29sYycsICdib29seCcsICd4c2Rib29sJywgJ2NvbnRhaW5zJywgJ2NvbnRhaW5zX2FueV9vZicsICdjb250YWluc19hbnlfbm90X29mJywgJ21hdGNoZXMnLCAnbGluZV9leGlzdHMnLCAnaXBvdycsICdjaGFyX29mZicsICdjb3VudCcsICdjb3VudF9hbnlfb2YnLCAnY291bnRfYW55X25vdF9vZicsICdkaXN0YW5jZScsICdjb25kZW5zZScsICdjb25jYXRfbGluZXNfb2YnLCAnZXNjYXBlJywgJ2ZpbmQnLCAnZmluZF9lbmQnLCAnZmluZF9hbnlfb2YnLCAnZmluZF9hbnlfbm90X29mJywgJ2luc2VydCcsICdtYXRjaCcsICdyZXBlYXQnLCAncmVwbGFjZScsICdyZXZlcnNlJywgJ3NlZ21lbnQnLCAnc2hpZnRfbGVmdCcsICdzaGlmdF9yaWdodCcsICdzdWJzdHJpbmcnLCAnc3Vic3RyaW5nX2FmdGVyJywgJ3N1YnN0cmluZ19mcm9tJywgJ3N1YnN0cmluZ19iZWZvcmUnLCAnc3Vic3RyaW5nX3RvJywgJ3RvX3VwcGVyJywgJ3RvX2xvd2VyJywgJ3RvX21peGVkJywgJ2Zyb21fbWl4ZWQnLCAndHJhbnNsYXRlJywgJ2JpdC1zZXQnLCAnbGluZV9pbmRleCcsXHJcbiAgICAnZGVmaW5pdGlvbicsICdpbXBsZW1lbnRhdGlvbicsICdwdWJsaWMnLCAnaW5oZXJpdGluZycsICdmaW5hbCdcclxuXTtcclxuZXhwb3J0IHZhciBsYW5ndWFnZSA9IHtcclxuICAgIGRlZmF1bHRUb2tlbjogJ2ludmFsaWQnLFxyXG4gICAgaWdub3JlQ2FzZTogdHJ1ZSxcclxuICAgIHRva2VuUG9zdGZpeDogJy5hYmFwJyxcclxuICAgIGtleXdvcmRzOiBhYmFwS2V5d29yZHMsXHJcbiAgICB0eXBlS2V5d29yZHM6IFtcclxuICAgICAgICAnYWJhcF9ib29sJywgJ3N0cmluZycsICd4c3RyaW5nJywgJ2FueScsICdjbGlrZScsICdjc2VxdWVuY2UnLCAnbnVtZXJpYycsXHJcbiAgICAgICAgJ3hzZXF1ZW5jZScsICdjJywgJ24nLCAnaScsICdwJywgJ2YnLCAnZCcsICd0JywgJ3gnXHJcbiAgICBdLFxyXG4gICAgb3BlcmF0b3JzOiBbXHJcbiAgICAgICAgJysnLCAnLScsICcvJywgJyonLFxyXG4gICAgICAgICc9JywgJzwnLCAnPicsICc8PScsICc+PScsICc8PicsICc+PCcsICc9PCcsICc9PicsXHJcbiAgICAgICAgJ0VRJywgJ05FJywgJ0dFJywgJ0xFJyxcclxuICAgICAgICAnQ1MnLCAnQ04nLCAnQ0EnLCAnQ08nLCAnQ1AnLCAnTlMnLCAnTkEnLCAnTlAnLFxyXG4gICAgXSxcclxuICAgIHN5bWJvbHM6IC9bPT48IX4/JitcXC0qXFwvXFxeJV0rLyxcclxuICAgIHRva2VuaXplcjoge1xyXG4gICAgICAgIHJvb3Q6IFtcclxuICAgICAgICAgICAgWy9bYS16XyRdW1xcdyRdKi8sIHsgY2FzZXM6IHsgJ0B0eXBlS2V5d29yZHMnOiAna2V5d29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHMnOiAna2V5d29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJyB9IH1dLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgWy9bOiwuXS8sICdkZWxpbWl0ZXInXSxcclxuICAgICAgICAgICAgWy9be30oKVxcW1xcXV0vLCAnQGJyYWNrZXRzJ10sXHJcbiAgICAgICAgICAgIFsvQHN5bWJvbHMvLCB7IGNhc2VzOiB7ICdAb3BlcmF0b3JzJzogJ29wZXJhdG9yJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJycgfSB9XSxcclxuICAgICAgICAgICAgWy8nLywgeyB0b2tlbjogJ3N0cmluZycsIGJyYWNrZXQ6ICdAb3BlbicsIG5leHQ6ICdAc3RyaW5ncXVvdGUnIH1dLFxyXG4gICAgICAgICAgICBbL1xcfC8sIHsgdG9rZW46ICdzdHJpbmcnLCBicmFja2V0OiAnQG9wZW4nLCBuZXh0OiAnQHN0cmluZ3RlbXBsYXRlJyB9XSxcclxuICAgICAgICAgICAgWy9cXGQrLywgJ251bWJlciddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3RyaW5ndGVtcGxhdGU6IFtcclxuICAgICAgICAgICAgWy9bXlxcXFxcXHxdKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9cXFxcXFx8LywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbL1xcfC8sIHsgdG9rZW46ICdzdHJpbmcnLCBicmFja2V0OiAnQGNsb3NlJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzdHJpbmdxdW90ZTogW1xyXG4gICAgICAgICAgICBbL1teXFxcXCddKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy8nLywgeyB0b2tlbjogJ3N0cmluZycsIGJyYWNrZXQ6ICdAY2xvc2UnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIHdoaXRlc3BhY2U6IFtcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rLywgJyddLFxyXG4gICAgICAgICAgICBbL15cXCouKiQvLCAnY29tbWVudCddLFxyXG4gICAgICAgICAgICBbL1xcXCIuKiQvLCAnY29tbWVudCddLFxyXG4gICAgICAgIF0sXHJcbiAgICB9LFxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9