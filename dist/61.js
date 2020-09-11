(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[61],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/vb/vb.js":
/*!********************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/vb/vb.js ***!
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
        lineComment: '\'',
        blockComment: ['/*', '*/'],
    },
    brackets: [
        ['{', '}'], ['[', ']'], ['(', ')'], ['<', '>'],
        ['addhandler', 'end addhandler'],
        ['class', 'end class'],
        ['enum', 'end enum'],
        ['event', 'end event'],
        ['function', 'end function'],
        ['get', 'end get'],
        ['if', 'end if'],
        ['interface', 'end interface'],
        ['module', 'end module'],
        ['namespace', 'end namespace'],
        ['operator', 'end operator'],
        ['property', 'end property'],
        ['raiseevent', 'end raiseevent'],
        ['removehandler', 'end removehandler'],
        ['select', 'end select'],
        ['set', 'end set'],
        ['structure', 'end structure'],
        ['sub', 'end sub'],
        ['synclock', 'end synclock'],
        ['try', 'end try'],
        ['while', 'end while'],
        ['with', 'end with'],
        ['using', 'end using'],
        ['do', 'loop'],
        ['for', 'next']
    ],
    autoClosingPairs: [
        { open: '{', close: '}', notIn: ['string', 'comment'] },
        { open: '[', close: ']', notIn: ['string', 'comment'] },
        { open: '(', close: ')', notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string', 'comment'] },
        { open: '<', close: '>', notIn: ['string', 'comment'] },
    ],
    folding: {
        markers: {
            start: new RegExp("^\\s*#Region\\b"),
            end: new RegExp("^\\s*#End Region\\b")
        }
    }
};
var language = {
    defaultToken: '',
    tokenPostfix: '.vb',
    ignoreCase: true,
    brackets: [
        { token: 'delimiter.bracket', open: '{', close: '}' },
        { token: 'delimiter.array', open: '[', close: ']' },
        { token: 'delimiter.parenthesis', open: '(', close: ')' },
        { token: 'delimiter.angle', open: '<', close: '>' },
        // Special bracket statement pairs
        // according to https://msdn.microsoft.com/en-us/library/tsw2a11z.aspx
        { token: 'keyword.tag-addhandler', open: 'addhandler', close: 'end addhandler' },
        { token: 'keyword.tag-class', open: 'class', close: 'end class' },
        { token: 'keyword.tag-enum', open: 'enum', close: 'end enum' },
        { token: 'keyword.tag-event', open: 'event', close: 'end event' },
        { token: 'keyword.tag-function', open: 'function', close: 'end function' },
        { token: 'keyword.tag-get', open: 'get', close: 'end get' },
        { token: 'keyword.tag-if', open: 'if', close: 'end if' },
        { token: 'keyword.tag-interface', open: 'interface', close: 'end interface' },
        { token: 'keyword.tag-module', open: 'module', close: 'end module' },
        { token: 'keyword.tag-namespace', open: 'namespace', close: 'end namespace' },
        { token: 'keyword.tag-operator', open: 'operator', close: 'end operator' },
        { token: 'keyword.tag-property', open: 'property', close: 'end property' },
        { token: 'keyword.tag-raiseevent', open: 'raiseevent', close: 'end raiseevent' },
        { token: 'keyword.tag-removehandler', open: 'removehandler', close: 'end removehandler' },
        { token: 'keyword.tag-select', open: 'select', close: 'end select' },
        { token: 'keyword.tag-set', open: 'set', close: 'end set' },
        { token: 'keyword.tag-structure', open: 'structure', close: 'end structure' },
        { token: 'keyword.tag-sub', open: 'sub', close: 'end sub' },
        { token: 'keyword.tag-synclock', open: 'synclock', close: 'end synclock' },
        { token: 'keyword.tag-try', open: 'try', close: 'end try' },
        { token: 'keyword.tag-while', open: 'while', close: 'end while' },
        { token: 'keyword.tag-with', open: 'with', close: 'end with' },
        // Other pairs
        { token: 'keyword.tag-using', open: 'using', close: 'end using' },
        { token: 'keyword.tag-do', open: 'do', close: 'loop' },
        { token: 'keyword.tag-for', open: 'for', close: 'next' }
    ],
    keywords: [
        'AddHandler', 'AddressOf', 'Alias', 'And', 'AndAlso', 'As', 'Async', 'Boolean', 'ByRef', 'Byte', 'ByVal', 'Call',
        'Case', 'Catch', 'CBool', 'CByte', 'CChar', 'CDate', 'CDbl', 'CDec', 'Char', 'CInt', 'Class', 'CLng',
        'CObj', 'Const', 'Continue', 'CSByte', 'CShort', 'CSng', 'CStr', 'CType', 'CUInt', 'CULng', 'CUShort',
        'Date', 'Decimal', 'Declare', 'Default', 'Delegate', 'Dim', 'DirectCast', 'Do', 'Double', 'Each', 'Else',
        'ElseIf', 'End', 'EndIf', 'Enum', 'Erase', 'Error', 'Event', 'Exit', 'False', 'Finally', 'For', 'Friend',
        'Function', 'Get', 'GetType', 'GetXMLNamespace', 'Global', 'GoSub', 'GoTo', 'Handles', 'If', 'Implements',
        'Imports', 'In', 'Inherits', 'Integer', 'Interface', 'Is', 'IsNot', 'Let', 'Lib', 'Like', 'Long', 'Loop',
        'Me', 'Mod', 'Module', 'MustInherit', 'MustOverride', 'MyBase', 'MyClass', 'NameOf', 'Namespace', 'Narrowing', 'New',
        'Next', 'Not', 'Nothing', 'NotInheritable', 'NotOverridable', 'Object', 'Of', 'On', 'Operator', 'Option',
        'Optional', 'Or', 'OrElse', 'Out', 'Overloads', 'Overridable', 'Overrides', 'ParamArray', 'Partial',
        'Private', 'Property', 'Protected', 'Public', 'RaiseEvent', 'ReadOnly', 'ReDim', 'RemoveHandler', 'Resume',
        'Return', 'SByte', 'Select', 'Set', 'Shadows', 'Shared', 'Short', 'Single', 'Static', 'Step', 'Stop',
        'String', 'Structure', 'Sub', 'SyncLock', 'Then', 'Throw', 'To', 'True', 'Try', 'TryCast', 'TypeOf',
        'UInteger', 'ULong', 'UShort', 'Using', 'Variant', 'Wend', 'When', 'While', 'Widening', 'With', 'WithEvents',
        'WriteOnly', 'Xor'
    ],
    tagwords: [
        'If', 'Sub', 'Select', 'Try', 'Class', 'Enum',
        'Function', 'Get', 'Interface', 'Module', 'Namespace', 'Operator', 'Set', 'Structure', 'Using', 'While', 'With',
        'Do', 'Loop', 'For', 'Next', 'Property', 'Continue', 'AddHandler', 'RemoveHandler', 'Event', 'RaiseEvent', 'SyncLock'
    ],
    // we include these common regular expressions
    symbols: /[=><!~?;\.,:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    integersuffix: /U?[DI%L&S@]?/,
    floatsuffix: /[R#F!]?/,
    // The main tokenizer for our languages
    tokenizer: {
        root: [
            // whitespace
            { include: '@whitespace' },
            // special ending tag-words
            [/next(?!\w)/, { token: 'keyword.tag-for' }],
            [/loop(?!\w)/, { token: 'keyword.tag-do' }],
            // usual ending tags
            [/end\s+(?!for|do)(addhandler|class|enum|event|function|get|if|interface|module|namespace|operator|property|raiseevent|removehandler|select|set|structure|sub|synclock|try|while|with|using)/, { token: 'keyword.tag-$1' }],
            // identifiers, tagwords, and keywords
            [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@tagwords': { token: 'keyword.tag-$0' },
                        '@keywords': { token: 'keyword.$0' },
                        '@default': 'identifier'
                    }
                }],
            // Preprocessor directive
            [/^\s*#\w+/, 'keyword'],
            // numbers
            [/\d*\d+e([\-+]?\d+)?(@floatsuffix)/, 'number.float'],
            [/\d*\.\d+(e[\-+]?\d+)?(@floatsuffix)/, 'number.float'],
            [/&H[0-9a-f]+(@integersuffix)/, 'number.hex'],
            [/&0[0-7]+(@integersuffix)/, 'number.octal'],
            [/\d+(@integersuffix)/, 'number'],
            // date literal
            [/#.*#/, 'number'],
            // delimiters and operators
            [/[{}()\[\]]/, '@brackets'],
            [/@symbols/, 'delimiter'],
            // strings
            [/"/, 'string', '@string'],
        ],
        whitespace: [
            [/[ \t\r\n]+/, ''],
            [/(\'|REM(?!\w)).*$/, 'comment'],
        ],
        string: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"C?/, 'string', '@pop']
        ],
    },
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3ZiL3ZiLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNhO0FBQ047QUFDUDtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSxXQUFXLEtBQUs7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksaUNBQWlDO0FBQy9ELFNBQVMsc0RBQXNEO0FBQy9ELFNBQVMsc0RBQXNEO0FBQy9ELFNBQVMsc0RBQXNEO0FBQy9ELFNBQVMsc0RBQXNEO0FBQy9EO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxxQ0FBcUMsWUFBWSxHQUFHO0FBQzdELFNBQVMsa0RBQWtEO0FBQzNELFNBQVMsd0RBQXdEO0FBQ2pFLFNBQVMsa0RBQWtEO0FBQzNEO0FBQ0E7QUFDQSxTQUFTLCtFQUErRTtBQUN4RixTQUFTLGdFQUFnRTtBQUN6RSxTQUFTLDZEQUE2RDtBQUN0RSxTQUFTLGdFQUFnRTtBQUN6RSxTQUFTLHlFQUF5RTtBQUNsRixTQUFTLDBEQUEwRDtBQUNuRSxTQUFTLHVEQUF1RDtBQUNoRSxTQUFTLDRFQUE0RTtBQUNyRixTQUFTLG1FQUFtRTtBQUM1RSxTQUFTLDRFQUE0RTtBQUNyRixTQUFTLHlFQUF5RTtBQUNsRixTQUFTLHlFQUF5RTtBQUNsRixTQUFTLCtFQUErRTtBQUN4RixTQUFTLHdGQUF3RjtBQUNqRyxTQUFTLG1FQUFtRTtBQUM1RSxTQUFTLDBEQUEwRDtBQUNuRSxTQUFTLDRFQUE0RTtBQUNyRixTQUFTLDBEQUEwRDtBQUNuRSxTQUFTLHlFQUF5RTtBQUNsRixTQUFTLDBEQUEwRDtBQUNuRSxTQUFTLGdFQUFnRTtBQUN6RSxTQUFTLDZEQUE2RDtBQUN0RTtBQUNBLFNBQVMsZ0VBQWdFO0FBQ3pFLFNBQVMscURBQXFEO0FBQzlELFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0I7QUFDdEIsOENBQThDLElBQUksY0FBYyxFQUFFLGNBQWMsRUFBRTtBQUNsRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhLHlCQUF5QjtBQUN0QztBQUNBLDRCQUE0QiwyQkFBMkI7QUFDdkQsNEJBQTRCLDBCQUEwQjtBQUN0RDtBQUNBLDRNQUE0TSwwQkFBMEI7QUFDdE87QUFDQTtBQUNBO0FBQ0Esc0NBQXNDLDBCQUEwQjtBQUNoRSxzQ0FBc0Msc0JBQXNCO0FBQzVEO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMIiwiZmlsZSI6IjYxLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBsaW5lQ29tbWVudDogJ1xcJycsXHJcbiAgICAgICAgYmxvY2tDb21tZW50OiBbJy8qJywgJyovJ10sXHJcbiAgICB9LFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICBbJ3snLCAnfSddLCBbJ1snLCAnXSddLCBbJygnLCAnKSddLCBbJzwnLCAnPiddLFxyXG4gICAgICAgIFsnYWRkaGFuZGxlcicsICdlbmQgYWRkaGFuZGxlciddLFxyXG4gICAgICAgIFsnY2xhc3MnLCAnZW5kIGNsYXNzJ10sXHJcbiAgICAgICAgWydlbnVtJywgJ2VuZCBlbnVtJ10sXHJcbiAgICAgICAgWydldmVudCcsICdlbmQgZXZlbnQnXSxcclxuICAgICAgICBbJ2Z1bmN0aW9uJywgJ2VuZCBmdW5jdGlvbiddLFxyXG4gICAgICAgIFsnZ2V0JywgJ2VuZCBnZXQnXSxcclxuICAgICAgICBbJ2lmJywgJ2VuZCBpZiddLFxyXG4gICAgICAgIFsnaW50ZXJmYWNlJywgJ2VuZCBpbnRlcmZhY2UnXSxcclxuICAgICAgICBbJ21vZHVsZScsICdlbmQgbW9kdWxlJ10sXHJcbiAgICAgICAgWyduYW1lc3BhY2UnLCAnZW5kIG5hbWVzcGFjZSddLFxyXG4gICAgICAgIFsnb3BlcmF0b3InLCAnZW5kIG9wZXJhdG9yJ10sXHJcbiAgICAgICAgWydwcm9wZXJ0eScsICdlbmQgcHJvcGVydHknXSxcclxuICAgICAgICBbJ3JhaXNlZXZlbnQnLCAnZW5kIHJhaXNlZXZlbnQnXSxcclxuICAgICAgICBbJ3JlbW92ZWhhbmRsZXInLCAnZW5kIHJlbW92ZWhhbmRsZXInXSxcclxuICAgICAgICBbJ3NlbGVjdCcsICdlbmQgc2VsZWN0J10sXHJcbiAgICAgICAgWydzZXQnLCAnZW5kIHNldCddLFxyXG4gICAgICAgIFsnc3RydWN0dXJlJywgJ2VuZCBzdHJ1Y3R1cmUnXSxcclxuICAgICAgICBbJ3N1YicsICdlbmQgc3ViJ10sXHJcbiAgICAgICAgWydzeW5jbG9jaycsICdlbmQgc3luY2xvY2snXSxcclxuICAgICAgICBbJ3RyeScsICdlbmQgdHJ5J10sXHJcbiAgICAgICAgWyd3aGlsZScsICdlbmQgd2hpbGUnXSxcclxuICAgICAgICBbJ3dpdGgnLCAnZW5kIHdpdGgnXSxcclxuICAgICAgICBbJ3VzaW5nJywgJ2VuZCB1c2luZyddLFxyXG4gICAgICAgIFsnZG8nLCAnbG9vcCddLFxyXG4gICAgICAgIFsnZm9yJywgJ25leHQnXVxyXG4gICAgXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9Jywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnPCcsIGNsb3NlOiAnPicsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcclxuICAgIF0sXHJcbiAgICBmb2xkaW5nOiB7XHJcbiAgICAgICAgbWFya2Vyczoge1xyXG4gICAgICAgICAgICBzdGFydDogbmV3IFJlZ0V4cChcIl5cXFxccyojUmVnaW9uXFxcXGJcIiksXHJcbiAgICAgICAgICAgIGVuZDogbmV3IFJlZ0V4cChcIl5cXFxccyojRW5kIFJlZ2lvblxcXFxiXCIpXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5leHBvcnQgdmFyIGxhbmd1YWdlID0ge1xyXG4gICAgZGVmYXVsdFRva2VuOiAnJyxcclxuICAgIHRva2VuUG9zdGZpeDogJy52YicsXHJcbiAgICBpZ25vcmVDYXNlOiB0cnVlLFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICB7IHRva2VuOiAnZGVsaW1pdGVyLmJyYWNrZXQnLCBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IHRva2VuOiAnZGVsaW1pdGVyLmFycmF5Jywgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyB0b2tlbjogJ2RlbGltaXRlci5wYXJlbnRoZXNpcycsIG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdkZWxpbWl0ZXIuYW5nbGUnLCBvcGVuOiAnPCcsIGNsb3NlOiAnPicgfSxcclxuICAgICAgICAvLyBTcGVjaWFsIGJyYWNrZXQgc3RhdGVtZW50IHBhaXJzXHJcbiAgICAgICAgLy8gYWNjb3JkaW5nIHRvIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvdHN3MmExMXouYXNweFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1hZGRoYW5kbGVyJywgb3BlbjogJ2FkZGhhbmRsZXInLCBjbG9zZTogJ2VuZCBhZGRoYW5kbGVyJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1jbGFzcycsIG9wZW46ICdjbGFzcycsIGNsb3NlOiAnZW5kIGNsYXNzJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1lbnVtJywgb3BlbjogJ2VudW0nLCBjbG9zZTogJ2VuZCBlbnVtJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1ldmVudCcsIG9wZW46ICdldmVudCcsIGNsb3NlOiAnZW5kIGV2ZW50JyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1mdW5jdGlvbicsIG9wZW46ICdmdW5jdGlvbicsIGNsb3NlOiAnZW5kIGZ1bmN0aW9uJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1nZXQnLCBvcGVuOiAnZ2V0JywgY2xvc2U6ICdlbmQgZ2V0JyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1pZicsIG9wZW46ICdpZicsIGNsb3NlOiAnZW5kIGlmJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1pbnRlcmZhY2UnLCBvcGVuOiAnaW50ZXJmYWNlJywgY2xvc2U6ICdlbmQgaW50ZXJmYWNlJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1tb2R1bGUnLCBvcGVuOiAnbW9kdWxlJywgY2xvc2U6ICdlbmQgbW9kdWxlJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1uYW1lc3BhY2UnLCBvcGVuOiAnbmFtZXNwYWNlJywgY2xvc2U6ICdlbmQgbmFtZXNwYWNlJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1vcGVyYXRvcicsIG9wZW46ICdvcGVyYXRvcicsIGNsb3NlOiAnZW5kIG9wZXJhdG9yJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1wcm9wZXJ0eScsIG9wZW46ICdwcm9wZXJ0eScsIGNsb3NlOiAnZW5kIHByb3BlcnR5JyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1yYWlzZWV2ZW50Jywgb3BlbjogJ3JhaXNlZXZlbnQnLCBjbG9zZTogJ2VuZCByYWlzZWV2ZW50JyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1yZW1vdmVoYW5kbGVyJywgb3BlbjogJ3JlbW92ZWhhbmRsZXInLCBjbG9zZTogJ2VuZCByZW1vdmVoYW5kbGVyJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1zZWxlY3QnLCBvcGVuOiAnc2VsZWN0JywgY2xvc2U6ICdlbmQgc2VsZWN0JyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1zZXQnLCBvcGVuOiAnc2V0JywgY2xvc2U6ICdlbmQgc2V0JyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1zdHJ1Y3R1cmUnLCBvcGVuOiAnc3RydWN0dXJlJywgY2xvc2U6ICdlbmQgc3RydWN0dXJlJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1zdWInLCBvcGVuOiAnc3ViJywgY2xvc2U6ICdlbmQgc3ViJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1zeW5jbG9jaycsIG9wZW46ICdzeW5jbG9jaycsIGNsb3NlOiAnZW5kIHN5bmNsb2NrJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy10cnknLCBvcGVuOiAndHJ5JywgY2xvc2U6ICdlbmQgdHJ5JyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy13aGlsZScsIG9wZW46ICd3aGlsZScsIGNsb3NlOiAnZW5kIHdoaWxlJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy13aXRoJywgb3BlbjogJ3dpdGgnLCBjbG9zZTogJ2VuZCB3aXRoJyB9LFxyXG4gICAgICAgIC8vIE90aGVyIHBhaXJzXHJcbiAgICAgICAgeyB0b2tlbjogJ2tleXdvcmQudGFnLXVzaW5nJywgb3BlbjogJ3VzaW5nJywgY2xvc2U6ICdlbmQgdXNpbmcnIH0sXHJcbiAgICAgICAgeyB0b2tlbjogJ2tleXdvcmQudGFnLWRvJywgb3BlbjogJ2RvJywgY2xvc2U6ICdsb29wJyB9LFxyXG4gICAgICAgIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1mb3InLCBvcGVuOiAnZm9yJywgY2xvc2U6ICduZXh0JyB9XHJcbiAgICBdLFxyXG4gICAga2V5d29yZHM6IFtcclxuICAgICAgICAnQWRkSGFuZGxlcicsICdBZGRyZXNzT2YnLCAnQWxpYXMnLCAnQW5kJywgJ0FuZEFsc28nLCAnQXMnLCAnQXN5bmMnLCAnQm9vbGVhbicsICdCeVJlZicsICdCeXRlJywgJ0J5VmFsJywgJ0NhbGwnLFxyXG4gICAgICAgICdDYXNlJywgJ0NhdGNoJywgJ0NCb29sJywgJ0NCeXRlJywgJ0NDaGFyJywgJ0NEYXRlJywgJ0NEYmwnLCAnQ0RlYycsICdDaGFyJywgJ0NJbnQnLCAnQ2xhc3MnLCAnQ0xuZycsXHJcbiAgICAgICAgJ0NPYmonLCAnQ29uc3QnLCAnQ29udGludWUnLCAnQ1NCeXRlJywgJ0NTaG9ydCcsICdDU25nJywgJ0NTdHInLCAnQ1R5cGUnLCAnQ1VJbnQnLCAnQ1VMbmcnLCAnQ1VTaG9ydCcsXHJcbiAgICAgICAgJ0RhdGUnLCAnRGVjaW1hbCcsICdEZWNsYXJlJywgJ0RlZmF1bHQnLCAnRGVsZWdhdGUnLCAnRGltJywgJ0RpcmVjdENhc3QnLCAnRG8nLCAnRG91YmxlJywgJ0VhY2gnLCAnRWxzZScsXHJcbiAgICAgICAgJ0Vsc2VJZicsICdFbmQnLCAnRW5kSWYnLCAnRW51bScsICdFcmFzZScsICdFcnJvcicsICdFdmVudCcsICdFeGl0JywgJ0ZhbHNlJywgJ0ZpbmFsbHknLCAnRm9yJywgJ0ZyaWVuZCcsXHJcbiAgICAgICAgJ0Z1bmN0aW9uJywgJ0dldCcsICdHZXRUeXBlJywgJ0dldFhNTE5hbWVzcGFjZScsICdHbG9iYWwnLCAnR29TdWInLCAnR29UbycsICdIYW5kbGVzJywgJ0lmJywgJ0ltcGxlbWVudHMnLFxyXG4gICAgICAgICdJbXBvcnRzJywgJ0luJywgJ0luaGVyaXRzJywgJ0ludGVnZXInLCAnSW50ZXJmYWNlJywgJ0lzJywgJ0lzTm90JywgJ0xldCcsICdMaWInLCAnTGlrZScsICdMb25nJywgJ0xvb3AnLFxyXG4gICAgICAgICdNZScsICdNb2QnLCAnTW9kdWxlJywgJ011c3RJbmhlcml0JywgJ011c3RPdmVycmlkZScsICdNeUJhc2UnLCAnTXlDbGFzcycsICdOYW1lT2YnLCAnTmFtZXNwYWNlJywgJ05hcnJvd2luZycsICdOZXcnLFxyXG4gICAgICAgICdOZXh0JywgJ05vdCcsICdOb3RoaW5nJywgJ05vdEluaGVyaXRhYmxlJywgJ05vdE92ZXJyaWRhYmxlJywgJ09iamVjdCcsICdPZicsICdPbicsICdPcGVyYXRvcicsICdPcHRpb24nLFxyXG4gICAgICAgICdPcHRpb25hbCcsICdPcicsICdPckVsc2UnLCAnT3V0JywgJ092ZXJsb2FkcycsICdPdmVycmlkYWJsZScsICdPdmVycmlkZXMnLCAnUGFyYW1BcnJheScsICdQYXJ0aWFsJyxcclxuICAgICAgICAnUHJpdmF0ZScsICdQcm9wZXJ0eScsICdQcm90ZWN0ZWQnLCAnUHVibGljJywgJ1JhaXNlRXZlbnQnLCAnUmVhZE9ubHknLCAnUmVEaW0nLCAnUmVtb3ZlSGFuZGxlcicsICdSZXN1bWUnLFxyXG4gICAgICAgICdSZXR1cm4nLCAnU0J5dGUnLCAnU2VsZWN0JywgJ1NldCcsICdTaGFkb3dzJywgJ1NoYXJlZCcsICdTaG9ydCcsICdTaW5nbGUnLCAnU3RhdGljJywgJ1N0ZXAnLCAnU3RvcCcsXHJcbiAgICAgICAgJ1N0cmluZycsICdTdHJ1Y3R1cmUnLCAnU3ViJywgJ1N5bmNMb2NrJywgJ1RoZW4nLCAnVGhyb3cnLCAnVG8nLCAnVHJ1ZScsICdUcnknLCAnVHJ5Q2FzdCcsICdUeXBlT2YnLFxyXG4gICAgICAgICdVSW50ZWdlcicsICdVTG9uZycsICdVU2hvcnQnLCAnVXNpbmcnLCAnVmFyaWFudCcsICdXZW5kJywgJ1doZW4nLCAnV2hpbGUnLCAnV2lkZW5pbmcnLCAnV2l0aCcsICdXaXRoRXZlbnRzJyxcclxuICAgICAgICAnV3JpdGVPbmx5JywgJ1hvcidcclxuICAgIF0sXHJcbiAgICB0YWd3b3JkczogW1xyXG4gICAgICAgICdJZicsICdTdWInLCAnU2VsZWN0JywgJ1RyeScsICdDbGFzcycsICdFbnVtJyxcclxuICAgICAgICAnRnVuY3Rpb24nLCAnR2V0JywgJ0ludGVyZmFjZScsICdNb2R1bGUnLCAnTmFtZXNwYWNlJywgJ09wZXJhdG9yJywgJ1NldCcsICdTdHJ1Y3R1cmUnLCAnVXNpbmcnLCAnV2hpbGUnLCAnV2l0aCcsXHJcbiAgICAgICAgJ0RvJywgJ0xvb3AnLCAnRm9yJywgJ05leHQnLCAnUHJvcGVydHknLCAnQ29udGludWUnLCAnQWRkSGFuZGxlcicsICdSZW1vdmVIYW5kbGVyJywgJ0V2ZW50JywgJ1JhaXNlRXZlbnQnLCAnU3luY0xvY2snXHJcbiAgICBdLFxyXG4gICAgLy8gd2UgaW5jbHVkZSB0aGVzZSBjb21tb24gcmVndWxhciBleHByZXNzaW9uc1xyXG4gICAgc3ltYm9sczogL1s9Pjwhfj87XFwuLDomfCtcXC0qXFwvXFxeJV0rLyxcclxuICAgIGVzY2FwZXM6IC9cXFxcKD86W2FiZm5ydHZcXFxcXCInXXx4WzAtOUEtRmEtZl17MSw0fXx1WzAtOUEtRmEtZl17NH18VVswLTlBLUZhLWZdezh9KS8sXHJcbiAgICBpbnRlZ2Vyc3VmZml4OiAvVT9bREklTCZTQF0/LyxcclxuICAgIGZsb2F0c3VmZml4OiAvW1IjRiFdPy8sXHJcbiAgICAvLyBUaGUgbWFpbiB0b2tlbml6ZXIgZm9yIG91ciBsYW5ndWFnZXNcclxuICAgIHRva2VuaXplcjoge1xyXG4gICAgICAgIHJvb3Q6IFtcclxuICAgICAgICAgICAgLy8gd2hpdGVzcGFjZVxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgLy8gc3BlY2lhbCBlbmRpbmcgdGFnLXdvcmRzXHJcbiAgICAgICAgICAgIFsvbmV4dCg/IVxcdykvLCB7IHRva2VuOiAna2V5d29yZC50YWctZm9yJyB9XSxcclxuICAgICAgICAgICAgWy9sb29wKD8hXFx3KS8sIHsgdG9rZW46ICdrZXl3b3JkLnRhZy1kbycgfV0sXHJcbiAgICAgICAgICAgIC8vIHVzdWFsIGVuZGluZyB0YWdzXHJcbiAgICAgICAgICAgIFsvZW5kXFxzKyg/IWZvcnxkbykoYWRkaGFuZGxlcnxjbGFzc3xlbnVtfGV2ZW50fGZ1bmN0aW9ufGdldHxpZnxpbnRlcmZhY2V8bW9kdWxlfG5hbWVzcGFjZXxvcGVyYXRvcnxwcm9wZXJ0eXxyYWlzZWV2ZW50fHJlbW92ZWhhbmRsZXJ8c2VsZWN0fHNldHxzdHJ1Y3R1cmV8c3VifHN5bmNsb2NrfHRyeXx3aGlsZXx3aXRofHVzaW5nKS8sIHsgdG9rZW46ICdrZXl3b3JkLnRhZy0kMScgfV0sXHJcbiAgICAgICAgICAgIC8vIGlkZW50aWZpZXJzLCB0YWd3b3JkcywgYW5kIGtleXdvcmRzXHJcbiAgICAgICAgICAgIFsvW2EtekEtWl9dXFx3Ki8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHRhZ3dvcmRzJzogeyB0b2tlbjogJ2tleXdvcmQudGFnLSQwJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogeyB0b2tlbjogJ2tleXdvcmQuJDAnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgICAgICAvLyBQcmVwcm9jZXNzb3IgZGlyZWN0aXZlXHJcbiAgICAgICAgICAgIFsvXlxccyojXFx3Ky8sICdrZXl3b3JkJ10sXHJcbiAgICAgICAgICAgIC8vIG51bWJlcnNcclxuICAgICAgICAgICAgWy9cXGQqXFxkK2UoW1xcLStdP1xcZCspPyhAZmxvYXRzdWZmaXgpLywgJ251bWJlci5mbG9hdCddLFxyXG4gICAgICAgICAgICBbL1xcZCpcXC5cXGQrKGVbXFwtK10/XFxkKyk/KEBmbG9hdHN1ZmZpeCkvLCAnbnVtYmVyLmZsb2F0J10sXHJcbiAgICAgICAgICAgIFsvJkhbMC05YS1mXSsoQGludGVnZXJzdWZmaXgpLywgJ251bWJlci5oZXgnXSxcclxuICAgICAgICAgICAgWy8mMFswLTddKyhAaW50ZWdlcnN1ZmZpeCkvLCAnbnVtYmVyLm9jdGFsJ10sXHJcbiAgICAgICAgICAgIFsvXFxkKyhAaW50ZWdlcnN1ZmZpeCkvLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIC8vIGRhdGUgbGl0ZXJhbFxyXG4gICAgICAgICAgICBbLyMuKiMvLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIC8vIGRlbGltaXRlcnMgYW5kIG9wZXJhdG9yc1xyXG4gICAgICAgICAgICBbL1t7fSgpXFxbXFxdXS8sICdAYnJhY2tldHMnXSxcclxuICAgICAgICAgICAgWy9Ac3ltYm9scy8sICdkZWxpbWl0ZXInXSxcclxuICAgICAgICAgICAgLy8gc3RyaW5nc1xyXG4gICAgICAgICAgICBbL1wiLywgJ3N0cmluZycsICdAc3RyaW5nJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3aGl0ZXNwYWNlOiBbXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy8sICcnXSxcclxuICAgICAgICAgICAgWy8oXFwnfFJFTSg/IVxcdykpLiokLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHN0cmluZzogW1xyXG4gICAgICAgICAgICBbL1teXFxcXFwiXSsvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvQGVzY2FwZXMvLCAnc3RyaW5nLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL1xcXFwuLywgJ3N0cmluZy5lc2NhcGUuaW52YWxpZCddLFxyXG4gICAgICAgICAgICBbL1wiQz8vLCAnc3RyaW5nJywgJ0Bwb3AnXVxyXG4gICAgICAgIF0sXHJcbiAgICB9LFxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9