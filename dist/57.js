(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[57],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/swift/swift.js":
/*!**************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/swift/swift.js ***!
  \**************************************************************************/
/*! exports provided: conf, language */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "conf", function() { return conf; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "language", function() { return language; });
/*!---------------------------------------------------------------------------------------------
 *  Copyright (C) David Owens II, owensd.io. All rights reserved.
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
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: '`', close: '`' },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: '`', close: '`' },
    ]
};
var language = {
    defaultToken: '',
    tokenPostfix: '.swift',
    // TODO(owensd): Support the full range of unicode valid identifiers.
    identifier: /[a-zA-Z_][\w$]*/,
    // TODO(owensd): Support the @availability macro properly.
    attributes: [
        '@autoclosure', '@noescape', '@noreturn', '@NSApplicationMain', '@NSCopying', '@NSManaged',
        '@objc', '@UIApplicationMain', '@noreturn', '@availability', '@IBAction', '@IBDesignable', '@IBInspectable', '@IBOutlet'
    ],
    accessmodifiers: ['public', 'private', 'internal'],
    keywords: [
        '__COLUMN__', '__FILE__', '__FUNCTION__', '__LINE__', 'as', 'as!', 'as?', 'associativity', 'break', 'case', 'catch',
        'class', 'continue', 'convenience', 'default', 'deinit', 'didSet', 'do', 'dynamic', 'dynamicType',
        'else', 'enum', 'extension', 'fallthrough', 'final', 'for', 'func', 'get', 'guard', 'if', 'import', 'in', 'infix',
        'init', 'inout', 'internal', 'is', 'lazy', 'left', 'let', 'mutating', 'nil', 'none', 'nonmutating', 'operator',
        'optional', 'override', 'postfix', 'precedence', 'prefix', 'private', 'protocol', 'Protocol', 'public',
        'repeat', 'required', 'return', 'right', 'self', 'Self', 'set', 'static', 'struct', 'subscript', 'super', 'switch',
        'throw', 'throws', 'try', 'try!', 'Type', 'typealias', 'unowned', 'var', 'weak', 'where', 'while', 'willSet', 'FALSE', 'TRUE'
    ],
    symbols: /[=(){}\[\].,:;@#\_&\-<>`?!+*\\\/]/,
    // Moved . to operatorstart so it can be a delimiter
    operatorstart: /[\/=\-+!*%<>&|^~?\u00A1-\u00A7\u00A9\u00AB\u00AC\u00AE\u00B0-\u00B1\u00B6\u00BB\u00BF\u00D7\u00F7\u2016-\u2017\u2020-\u2027\u2030-\u203E\u2041-\u2053\u2055-\u205E\u2190-\u23FF\u2500-\u2775\u2794-\u2BFF\u2E00-\u2E7F\u3001-\u3003\u3008-\u3030]/,
    operatorend: /[\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE00-\uFE0F\uFE20-\uFE2F\uE0100-\uE01EF]/,
    operators: /(@operatorstart)((@operatorstart)|(@operatorend))*/,
    // TODO(owensd): These are borrowed from C#; need to validate correctness for Swift.
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    tokenizer: {
        root: [
            { include: '@whitespace' },
            { include: '@comment' },
            { include: '@attribute' },
            { include: '@literal' },
            { include: '@keyword' },
            { include: '@invokedmethod' },
            { include: '@symbol' },
        ],
        whitespace: [
            [/\s+/, 'white'],
            [/"""/, 'string.quote', '@endDblDocString']
        ],
        endDblDocString: [
            [/[^"]+/, 'string'],
            [/\\"/, 'string'],
            [/"""/, 'string.quote', '@popall'],
            [/"/, 'string']
        ],
        symbol: [
            [/[{}()\[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/[.]/, 'delimiter'],
            [/@operators/, 'operator'],
            [/@symbols/, 'operator']
        ],
        comment: [
            [/\/\/\/.*$/, 'comment.doc'],
            [/\/\*\*/, 'comment.doc', '@commentdocbody'],
            [/\/\/.*$/, 'comment'],
            [/\/\*/, 'comment', '@commentbody']
        ],
        commentdocbody: [
            [/\/\*/, 'comment', '@commentbody'],
            [/\*\//, 'comment.doc', '@pop'],
            [/\:[a-zA-Z]+\:/, 'comment.doc.param'],
            [/./, 'comment.doc']
        ],
        commentbody: [
            [/\/\*/, 'comment', '@commentbody'],
            [/\*\//, 'comment', '@pop'],
            [/./, 'comment']
        ],
        attribute: [
            [/\@@identifier/, {
                    cases: {
                        '@attributes': 'keyword.control',
                        '@default': ''
                    }
                }]
        ],
        literal: [
            [/"/, { token: 'string.quote', next: '@stringlit' }],
            [/0[b]([01]_?)+/, 'number.binary'],
            [/0[o]([0-7]_?)+/, 'number.octal'],
            [/0[x]([0-9a-fA-F]_?)+([pP][\-+](\d_?)+)?/, 'number.hex'],
            [/(\d_?)*\.(\d_?)+([eE][\-+]?(\d_?)+)?/, 'number.float'],
            [/(\d_?)+/, 'number']
        ],
        stringlit: [
            [/\\\(/, { token: 'operator', next: '@interpolatedexpression' }],
            [/@escapes/, 'string'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', next: '@pop' }],
            [/./, 'string']
        ],
        interpolatedexpression: [
            [/\(/, { token: 'operator', next: '@interpolatedexpression' }],
            [/\)/, { token: 'operator', next: '@pop' }],
            { include: '@literal' },
            { include: '@keyword' },
            { include: '@symbol' }
        ],
        keyword: [
            [/`/, { token: 'operator', next: '@escapedkeyword' }],
            [/@identifier/, {
                    cases: {
                        '@keywords': 'keyword', '[A-Z][\a-zA-Z0-9$]*': 'type.identifier',
                        '@default': 'identifier'
                    }
                }]
        ],
        escapedkeyword: [
            [/`/, { token: 'operator', next: '@pop' }],
            [/./, 'identifier']
        ],
        //		symbol: [
        //			[ /@symbols/, 'operator' ],
        //			[ /@operators/, 'operator' ]
        //		],
        invokedmethod: [
            [/([.])(@identifier)/, {
                    cases: {
                        '$2': ['delimeter', 'type.identifier'],
                        '@default': ''
                    }
                }],
        ]
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3N3aWZ0L3N3aWZ0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsV0FBVyxLQUFLO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUNqQztBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUNqQztBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFvQixRQUFRO0FBQzVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0RBQWdEO0FBQ2hELDhDQUE4QyxJQUFJLGNBQWMsRUFBRSxjQUFjLEVBQUU7QUFDbEY7QUFDQTtBQUNBLGFBQWEseUJBQXlCO0FBQ3RDLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEsd0JBQXdCO0FBQ3JDLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEsNEJBQTRCO0FBQ3pDLGFBQWEscUJBQXFCO0FBQ2xDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0EsbUJBQW1CLDRDQUE0QztBQUMvRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQixxREFBcUQ7QUFDM0U7QUFDQTtBQUNBLG1CQUFtQixzQ0FBc0M7QUFDekQ7QUFDQTtBQUNBO0FBQ0Esb0JBQW9CLHFEQUFxRDtBQUN6RSxvQkFBb0Isa0NBQWtDO0FBQ3RELGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWE7QUFDYjtBQUNBO0FBQ0EsbUJBQW1CLDZDQUE2QztBQUNoRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQSxtQkFBbUIsa0NBQWtDO0FBQ3JEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0EiLCJmaWxlIjoiNTcuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiEtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoQykgRGF2aWQgT3dlbnMgSUksIG93ZW5zZC5pby4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBsaW5lQ29tbWVudDogJy8vJyxcclxuICAgICAgICBibG9ja0NvbW1lbnQ6IFsnLyonLCAnKi8nXSxcclxuICAgIH0sXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIFsneycsICd9J10sXHJcbiAgICAgICAgWydbJywgJ10nXSxcclxuICAgICAgICBbJygnLCAnKSddXHJcbiAgICBdLFxyXG4gICAgYXV0b0Nsb3NpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgICAgICB7IG9wZW46ICdgJywgY2xvc2U6ICdgJyB9LFxyXG4gICAgXSxcclxuICAgIHN1cnJvdW5kaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnYCcsIGNsb3NlOiAnYCcgfSxcclxuICAgIF1cclxufTtcclxuZXhwb3J0IHZhciBsYW5ndWFnZSA9IHtcclxuICAgIGRlZmF1bHRUb2tlbjogJycsXHJcbiAgICB0b2tlblBvc3RmaXg6ICcuc3dpZnQnLFxyXG4gICAgLy8gVE9ETyhvd2Vuc2QpOiBTdXBwb3J0IHRoZSBmdWxsIHJhbmdlIG9mIHVuaWNvZGUgdmFsaWQgaWRlbnRpZmllcnMuXHJcbiAgICBpZGVudGlmaWVyOiAvW2EtekEtWl9dW1xcdyRdKi8sXHJcbiAgICAvLyBUT0RPKG93ZW5zZCk6IFN1cHBvcnQgdGhlIEBhdmFpbGFiaWxpdHkgbWFjcm8gcHJvcGVybHkuXHJcbiAgICBhdHRyaWJ1dGVzOiBbXHJcbiAgICAgICAgJ0BhdXRvY2xvc3VyZScsICdAbm9lc2NhcGUnLCAnQG5vcmV0dXJuJywgJ0BOU0FwcGxpY2F0aW9uTWFpbicsICdATlNDb3B5aW5nJywgJ0BOU01hbmFnZWQnLFxyXG4gICAgICAgICdAb2JqYycsICdAVUlBcHBsaWNhdGlvbk1haW4nLCAnQG5vcmV0dXJuJywgJ0BhdmFpbGFiaWxpdHknLCAnQElCQWN0aW9uJywgJ0BJQkRlc2lnbmFibGUnLCAnQElCSW5zcGVjdGFibGUnLCAnQElCT3V0bGV0J1xyXG4gICAgXSxcclxuICAgIGFjY2Vzc21vZGlmaWVyczogWydwdWJsaWMnLCAncHJpdmF0ZScsICdpbnRlcm5hbCddLFxyXG4gICAga2V5d29yZHM6IFtcclxuICAgICAgICAnX19DT0xVTU5fXycsICdfX0ZJTEVfXycsICdfX0ZVTkNUSU9OX18nLCAnX19MSU5FX18nLCAnYXMnLCAnYXMhJywgJ2FzPycsICdhc3NvY2lhdGl2aXR5JywgJ2JyZWFrJywgJ2Nhc2UnLCAnY2F0Y2gnLFxyXG4gICAgICAgICdjbGFzcycsICdjb250aW51ZScsICdjb252ZW5pZW5jZScsICdkZWZhdWx0JywgJ2RlaW5pdCcsICdkaWRTZXQnLCAnZG8nLCAnZHluYW1pYycsICdkeW5hbWljVHlwZScsXHJcbiAgICAgICAgJ2Vsc2UnLCAnZW51bScsICdleHRlbnNpb24nLCAnZmFsbHRocm91Z2gnLCAnZmluYWwnLCAnZm9yJywgJ2Z1bmMnLCAnZ2V0JywgJ2d1YXJkJywgJ2lmJywgJ2ltcG9ydCcsICdpbicsICdpbmZpeCcsXHJcbiAgICAgICAgJ2luaXQnLCAnaW5vdXQnLCAnaW50ZXJuYWwnLCAnaXMnLCAnbGF6eScsICdsZWZ0JywgJ2xldCcsICdtdXRhdGluZycsICduaWwnLCAnbm9uZScsICdub25tdXRhdGluZycsICdvcGVyYXRvcicsXHJcbiAgICAgICAgJ29wdGlvbmFsJywgJ292ZXJyaWRlJywgJ3Bvc3RmaXgnLCAncHJlY2VkZW5jZScsICdwcmVmaXgnLCAncHJpdmF0ZScsICdwcm90b2NvbCcsICdQcm90b2NvbCcsICdwdWJsaWMnLFxyXG4gICAgICAgICdyZXBlYXQnLCAncmVxdWlyZWQnLCAncmV0dXJuJywgJ3JpZ2h0JywgJ3NlbGYnLCAnU2VsZicsICdzZXQnLCAnc3RhdGljJywgJ3N0cnVjdCcsICdzdWJzY3JpcHQnLCAnc3VwZXInLCAnc3dpdGNoJyxcclxuICAgICAgICAndGhyb3cnLCAndGhyb3dzJywgJ3RyeScsICd0cnkhJywgJ1R5cGUnLCAndHlwZWFsaWFzJywgJ3Vub3duZWQnLCAndmFyJywgJ3dlYWsnLCAnd2hlcmUnLCAnd2hpbGUnLCAnd2lsbFNldCcsICdGQUxTRScsICdUUlVFJ1xyXG4gICAgXSxcclxuICAgIHN5bWJvbHM6IC9bPSgpe31cXFtcXF0uLDo7QCNcXF8mXFwtPD5gPyErKlxcXFxcXC9dLyxcclxuICAgIC8vIE1vdmVkIC4gdG8gb3BlcmF0b3JzdGFydCBzbyBpdCBjYW4gYmUgYSBkZWxpbWl0ZXJcclxuICAgIG9wZXJhdG9yc3RhcnQ6IC9bXFwvPVxcLSshKiU8PiZ8Xn4/XFx1MDBBMS1cXHUwMEE3XFx1MDBBOVxcdTAwQUJcXHUwMEFDXFx1MDBBRVxcdTAwQjAtXFx1MDBCMVxcdTAwQjZcXHUwMEJCXFx1MDBCRlxcdTAwRDdcXHUwMEY3XFx1MjAxNi1cXHUyMDE3XFx1MjAyMC1cXHUyMDI3XFx1MjAzMC1cXHUyMDNFXFx1MjA0MS1cXHUyMDUzXFx1MjA1NS1cXHUyMDVFXFx1MjE5MC1cXHUyM0ZGXFx1MjUwMC1cXHUyNzc1XFx1Mjc5NC1cXHUyQkZGXFx1MkUwMC1cXHUyRTdGXFx1MzAwMS1cXHUzMDAzXFx1MzAwOC1cXHUzMDMwXS8sXHJcbiAgICBvcGVyYXRvcmVuZDogL1tcXHUwMzAwLVxcdTAzNkZcXHUxREMwLVxcdTFERkZcXHUyMEQwLVxcdTIwRkZcXHVGRTAwLVxcdUZFMEZcXHVGRTIwLVxcdUZFMkZcXHVFMDEwMC1cXHVFMDFFRl0vLFxyXG4gICAgb3BlcmF0b3JzOiAvKEBvcGVyYXRvcnN0YXJ0KSgoQG9wZXJhdG9yc3RhcnQpfChAb3BlcmF0b3JlbmQpKSovLFxyXG4gICAgLy8gVE9ETyhvd2Vuc2QpOiBUaGVzZSBhcmUgYm9ycm93ZWQgZnJvbSBDIzsgbmVlZCB0byB2YWxpZGF0ZSBjb3JyZWN0bmVzcyBmb3IgU3dpZnQuXHJcbiAgICBlc2NhcGVzOiAvXFxcXCg/OlthYmZucnR2XFxcXFwiJ118eFswLTlBLUZhLWZdezEsNH18dVswLTlBLUZhLWZdezR9fFVbMC05QS1GYS1mXXs4fSkvLFxyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGNvbW1lbnQnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BhdHRyaWJ1dGUnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BsaXRlcmFsJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAa2V5d29yZCcgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGludm9rZWRtZXRob2QnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BzeW1ib2wnIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3aGl0ZXNwYWNlOiBbXHJcbiAgICAgICAgICAgIFsvXFxzKy8sICd3aGl0ZSddLFxyXG4gICAgICAgICAgICBbL1wiXCJcIi8sICdzdHJpbmcucXVvdGUnLCAnQGVuZERibERvY1N0cmluZyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBlbmREYmxEb2NTdHJpbmc6IFtcclxuICAgICAgICAgICAgWy9bXlwiXSsvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXFwiLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbL1wiXCJcIi8sICdzdHJpbmcucXVvdGUnLCAnQHBvcGFsbCddLFxyXG4gICAgICAgICAgICBbL1wiLywgJ3N0cmluZyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzeW1ib2w6IFtcclxuICAgICAgICAgICAgWy9be30oKVxcW1xcXV0vLCAnQGJyYWNrZXRzJ10sXHJcbiAgICAgICAgICAgIFsvWzw+XSg/IUBzeW1ib2xzKS8sICdAYnJhY2tldHMnXSxcclxuICAgICAgICAgICAgWy9bLl0vLCAnZGVsaW1pdGVyJ10sXHJcbiAgICAgICAgICAgIFsvQG9wZXJhdG9ycy8sICdvcGVyYXRvciddLFxyXG4gICAgICAgICAgICBbL0BzeW1ib2xzLywgJ29wZXJhdG9yJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIGNvbW1lbnQ6IFtcclxuICAgICAgICAgICAgWy9cXC9cXC9cXC8uKiQvLCAnY29tbWVudC5kb2MnXSxcclxuICAgICAgICAgICAgWy9cXC9cXCpcXCovLCAnY29tbWVudC5kb2MnLCAnQGNvbW1lbnRkb2Nib2R5J10sXHJcbiAgICAgICAgICAgIFsvXFwvXFwvLiokLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICAgICAgWy9cXC9cXCovLCAnY29tbWVudCcsICdAY29tbWVudGJvZHknXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29tbWVudGRvY2JvZHk6IFtcclxuICAgICAgICAgICAgWy9cXC9cXCovLCAnY29tbWVudCcsICdAY29tbWVudGJvZHknXSxcclxuICAgICAgICAgICAgWy9cXCpcXC8vLCAnY29tbWVudC5kb2MnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbL1xcOlthLXpBLVpdK1xcOi8sICdjb21tZW50LmRvYy5wYXJhbSddLFxyXG4gICAgICAgICAgICBbLy4vLCAnY29tbWVudC5kb2MnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29tbWVudGJvZHk6IFtcclxuICAgICAgICAgICAgWy9cXC9cXCovLCAnY29tbWVudCcsICdAY29tbWVudGJvZHknXSxcclxuICAgICAgICAgICAgWy9cXCpcXC8vLCAnY29tbWVudCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvLi8sICdjb21tZW50J11cclxuICAgICAgICBdLFxyXG4gICAgICAgIGF0dHJpYnV0ZTogW1xyXG4gICAgICAgICAgICBbL1xcQEBpZGVudGlmaWVyLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAYXR0cmlidXRlcyc6ICdrZXl3b3JkLmNvbnRyb2wnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBsaXRlcmFsOiBbXHJcbiAgICAgICAgICAgIFsvXCIvLCB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgbmV4dDogJ0BzdHJpbmdsaXQnIH1dLFxyXG4gICAgICAgICAgICBbLzBbYl0oWzAxXV8/KSsvLCAnbnVtYmVyLmJpbmFyeSddLFxyXG4gICAgICAgICAgICBbLzBbb10oWzAtN11fPykrLywgJ251bWJlci5vY3RhbCddLFxyXG4gICAgICAgICAgICBbLzBbeF0oWzAtOWEtZkEtRl1fPykrKFtwUF1bXFwtK10oXFxkXz8pKyk/LywgJ251bWJlci5oZXgnXSxcclxuICAgICAgICAgICAgWy8oXFxkXz8pKlxcLihcXGRfPykrKFtlRV1bXFwtK10/KFxcZF8/KSspPy8sICdudW1iZXIuZmxvYXQnXSxcclxuICAgICAgICAgICAgWy8oXFxkXz8pKy8sICdudW1iZXInXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3RyaW5nbGl0OiBbXHJcbiAgICAgICAgICAgIFsvXFxcXFxcKC8sIHsgdG9rZW46ICdvcGVyYXRvcicsIG5leHQ6ICdAaW50ZXJwb2xhdGVkZXhwcmVzc2lvbicgfV0sXHJcbiAgICAgICAgICAgIFsvQGVzY2FwZXMvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXC4vLCAnc3RyaW5nLmVzY2FwZS5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvXCIvLCB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbLy4vLCAnc3RyaW5nJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIGludGVycG9sYXRlZGV4cHJlc3Npb246IFtcclxuICAgICAgICAgICAgWy9cXCgvLCB7IHRva2VuOiAnb3BlcmF0b3InLCBuZXh0OiAnQGludGVycG9sYXRlZGV4cHJlc3Npb24nIH1dLFxyXG4gICAgICAgICAgICBbL1xcKS8sIHsgdG9rZW46ICdvcGVyYXRvcicsIG5leHQ6ICdAcG9wJyB9XSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGxpdGVyYWwnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BrZXl3b3JkJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAc3ltYm9sJyB9XHJcbiAgICAgICAgXSxcclxuICAgICAgICBrZXl3b3JkOiBbXHJcbiAgICAgICAgICAgIFsvYC8sIHsgdG9rZW46ICdvcGVyYXRvcicsIG5leHQ6ICdAZXNjYXBlZGtleXdvcmQnIH1dLFxyXG4gICAgICAgICAgICBbL0BpZGVudGlmaWVyLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHMnOiAna2V5d29yZCcsICdbQS1aXVtcXGEtekEtWjAtOSRdKic6ICd0eXBlLmlkZW50aWZpZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnaWRlbnRpZmllcidcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgZXNjYXBlZGtleXdvcmQ6IFtcclxuICAgICAgICAgICAgWy9gLywgeyB0b2tlbjogJ29wZXJhdG9yJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbLy4vLCAnaWRlbnRpZmllciddXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvL1x0XHRzeW1ib2w6IFtcclxuICAgICAgICAvL1x0XHRcdFsgL0BzeW1ib2xzLywgJ29wZXJhdG9yJyBdLFxyXG4gICAgICAgIC8vXHRcdFx0WyAvQG9wZXJhdG9ycy8sICdvcGVyYXRvcicgXVxyXG4gICAgICAgIC8vXHRcdF0sXHJcbiAgICAgICAgaW52b2tlZG1ldGhvZDogW1xyXG4gICAgICAgICAgICBbLyhbLl0pKEBpZGVudGlmaWVyKS8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJDInOiBbJ2RlbGltZXRlcicsICd0eXBlLmlkZW50aWZpZXInXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJydcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICBdXHJcbiAgICB9XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiIn0=