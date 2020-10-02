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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3N3aWZ0L3N3aWZ0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsV0FBVyxLQUFLO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUNqQztBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUNqQztBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFvQixRQUFRO0FBQzVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0RBQWdEO0FBQ2hELDhDQUE4QyxJQUFJLGNBQWMsRUFBRSxjQUFjLEVBQUU7QUFDbEY7QUFDQTtBQUNBLGFBQWEseUJBQXlCO0FBQ3RDLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEsd0JBQXdCO0FBQ3JDLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEsNEJBQTRCO0FBQ3pDLGFBQWEscUJBQXFCO0FBQ2xDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0EsbUJBQW1CLDRDQUE0QztBQUMvRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQixxREFBcUQ7QUFDM0U7QUFDQTtBQUNBLG1CQUFtQixzQ0FBc0M7QUFDekQ7QUFDQTtBQUNBO0FBQ0Esb0JBQW9CLHFEQUFxRDtBQUN6RSxvQkFBb0Isa0NBQWtDO0FBQ3RELGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWE7QUFDYjtBQUNBO0FBQ0EsbUJBQW1CLDZDQUE2QztBQUNoRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQSxtQkFBbUIsa0NBQWtDO0FBQ3JEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0EiLCJmaWxlIjoiNTcubWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChDKSBEYXZpZCBPd2VucyBJSSwgb3dlbnNkLmlvLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5leHBvcnQgdmFyIGNvbmYgPSB7XHJcbiAgICBjb21tZW50czoge1xyXG4gICAgICAgIGxpbmVDb21tZW50OiAnLy8nLFxyXG4gICAgICAgIGJsb2NrQ29tbWVudDogWycvKicsICcqLyddLFxyXG4gICAgfSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgWyd7JywgJ30nXSxcclxuICAgICAgICBbJ1snLCAnXSddLFxyXG4gICAgICAgIFsnKCcsICcpJ11cclxuICAgIF0sXHJcbiAgICBhdXRvQ2xvc2luZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXCInLCBjbG9zZTogJ1wiJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2AnLCBjbG9zZTogJ2AnIH0sXHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgICAgICB7IG9wZW46ICdgJywgY2xvc2U6ICdgJyB9LFxyXG4gICAgXVxyXG59O1xyXG5leHBvcnQgdmFyIGxhbmd1YWdlID0ge1xyXG4gICAgZGVmYXVsdFRva2VuOiAnJyxcclxuICAgIHRva2VuUG9zdGZpeDogJy5zd2lmdCcsXHJcbiAgICAvLyBUT0RPKG93ZW5zZCk6IFN1cHBvcnQgdGhlIGZ1bGwgcmFuZ2Ugb2YgdW5pY29kZSB2YWxpZCBpZGVudGlmaWVycy5cclxuICAgIGlkZW50aWZpZXI6IC9bYS16QS1aX11bXFx3JF0qLyxcclxuICAgIC8vIFRPRE8ob3dlbnNkKTogU3VwcG9ydCB0aGUgQGF2YWlsYWJpbGl0eSBtYWNybyBwcm9wZXJseS5cclxuICAgIGF0dHJpYnV0ZXM6IFtcclxuICAgICAgICAnQGF1dG9jbG9zdXJlJywgJ0Bub2VzY2FwZScsICdAbm9yZXR1cm4nLCAnQE5TQXBwbGljYXRpb25NYWluJywgJ0BOU0NvcHlpbmcnLCAnQE5TTWFuYWdlZCcsXHJcbiAgICAgICAgJ0BvYmpjJywgJ0BVSUFwcGxpY2F0aW9uTWFpbicsICdAbm9yZXR1cm4nLCAnQGF2YWlsYWJpbGl0eScsICdASUJBY3Rpb24nLCAnQElCRGVzaWduYWJsZScsICdASUJJbnNwZWN0YWJsZScsICdASUJPdXRsZXQnXHJcbiAgICBdLFxyXG4gICAgYWNjZXNzbW9kaWZpZXJzOiBbJ3B1YmxpYycsICdwcml2YXRlJywgJ2ludGVybmFsJ10sXHJcbiAgICBrZXl3b3JkczogW1xyXG4gICAgICAgICdfX0NPTFVNTl9fJywgJ19fRklMRV9fJywgJ19fRlVOQ1RJT05fXycsICdfX0xJTkVfXycsICdhcycsICdhcyEnLCAnYXM/JywgJ2Fzc29jaWF0aXZpdHknLCAnYnJlYWsnLCAnY2FzZScsICdjYXRjaCcsXHJcbiAgICAgICAgJ2NsYXNzJywgJ2NvbnRpbnVlJywgJ2NvbnZlbmllbmNlJywgJ2RlZmF1bHQnLCAnZGVpbml0JywgJ2RpZFNldCcsICdkbycsICdkeW5hbWljJywgJ2R5bmFtaWNUeXBlJyxcclxuICAgICAgICAnZWxzZScsICdlbnVtJywgJ2V4dGVuc2lvbicsICdmYWxsdGhyb3VnaCcsICdmaW5hbCcsICdmb3InLCAnZnVuYycsICdnZXQnLCAnZ3VhcmQnLCAnaWYnLCAnaW1wb3J0JywgJ2luJywgJ2luZml4JyxcclxuICAgICAgICAnaW5pdCcsICdpbm91dCcsICdpbnRlcm5hbCcsICdpcycsICdsYXp5JywgJ2xlZnQnLCAnbGV0JywgJ211dGF0aW5nJywgJ25pbCcsICdub25lJywgJ25vbm11dGF0aW5nJywgJ29wZXJhdG9yJyxcclxuICAgICAgICAnb3B0aW9uYWwnLCAnb3ZlcnJpZGUnLCAncG9zdGZpeCcsICdwcmVjZWRlbmNlJywgJ3ByZWZpeCcsICdwcml2YXRlJywgJ3Byb3RvY29sJywgJ1Byb3RvY29sJywgJ3B1YmxpYycsXHJcbiAgICAgICAgJ3JlcGVhdCcsICdyZXF1aXJlZCcsICdyZXR1cm4nLCAncmlnaHQnLCAnc2VsZicsICdTZWxmJywgJ3NldCcsICdzdGF0aWMnLCAnc3RydWN0JywgJ3N1YnNjcmlwdCcsICdzdXBlcicsICdzd2l0Y2gnLFxyXG4gICAgICAgICd0aHJvdycsICd0aHJvd3MnLCAndHJ5JywgJ3RyeSEnLCAnVHlwZScsICd0eXBlYWxpYXMnLCAndW5vd25lZCcsICd2YXInLCAnd2VhaycsICd3aGVyZScsICd3aGlsZScsICd3aWxsU2V0JywgJ0ZBTFNFJywgJ1RSVUUnXHJcbiAgICBdLFxyXG4gICAgc3ltYm9sczogL1s9KCl7fVxcW1xcXS4sOjtAI1xcXyZcXC08PmA/ISsqXFxcXFxcL10vLFxyXG4gICAgLy8gTW92ZWQgLiB0byBvcGVyYXRvcnN0YXJ0IHNvIGl0IGNhbiBiZSBhIGRlbGltaXRlclxyXG4gICAgb3BlcmF0b3JzdGFydDogL1tcXC89XFwtKyEqJTw+Jnxefj9cXHUwMEExLVxcdTAwQTdcXHUwMEE5XFx1MDBBQlxcdTAwQUNcXHUwMEFFXFx1MDBCMC1cXHUwMEIxXFx1MDBCNlxcdTAwQkJcXHUwMEJGXFx1MDBEN1xcdTAwRjdcXHUyMDE2LVxcdTIwMTdcXHUyMDIwLVxcdTIwMjdcXHUyMDMwLVxcdTIwM0VcXHUyMDQxLVxcdTIwNTNcXHUyMDU1LVxcdTIwNUVcXHUyMTkwLVxcdTIzRkZcXHUyNTAwLVxcdTI3NzVcXHUyNzk0LVxcdTJCRkZcXHUyRTAwLVxcdTJFN0ZcXHUzMDAxLVxcdTMwMDNcXHUzMDA4LVxcdTMwMzBdLyxcclxuICAgIG9wZXJhdG9yZW5kOiAvW1xcdTAzMDAtXFx1MDM2RlxcdTFEQzAtXFx1MURGRlxcdTIwRDAtXFx1MjBGRlxcdUZFMDAtXFx1RkUwRlxcdUZFMjAtXFx1RkUyRlxcdUUwMTAwLVxcdUUwMUVGXS8sXHJcbiAgICBvcGVyYXRvcnM6IC8oQG9wZXJhdG9yc3RhcnQpKChAb3BlcmF0b3JzdGFydCl8KEBvcGVyYXRvcmVuZCkpKi8sXHJcbiAgICAvLyBUT0RPKG93ZW5zZCk6IFRoZXNlIGFyZSBib3Jyb3dlZCBmcm9tIEMjOyBuZWVkIHRvIHZhbGlkYXRlIGNvcnJlY3RuZXNzIGZvciBTd2lmdC5cclxuICAgIGVzY2FwZXM6IC9cXFxcKD86W2FiZm5ydHZcXFxcXCInXXx4WzAtOUEtRmEtZl17MSw0fXx1WzAtOUEtRmEtZl17NH18VVswLTlBLUZhLWZdezh9KS8sXHJcbiAgICB0b2tlbml6ZXI6IHtcclxuICAgICAgICByb290OiBbXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B3aGl0ZXNwYWNlJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAY29tbWVudCcgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGF0dHJpYnV0ZScgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGxpdGVyYWwnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BrZXl3b3JkJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAaW52b2tlZG1ldGhvZCcgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHN5bWJvbCcgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHdoaXRlc3BhY2U6IFtcclxuICAgICAgICAgICAgWy9cXHMrLywgJ3doaXRlJ10sXHJcbiAgICAgICAgICAgIFsvXCJcIlwiLywgJ3N0cmluZy5xdW90ZScsICdAZW5kRGJsRG9jU3RyaW5nJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIGVuZERibERvY1N0cmluZzogW1xyXG4gICAgICAgICAgICBbL1teXCJdKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9cXFxcXCIvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvXCJcIlwiLywgJ3N0cmluZy5xdW90ZScsICdAcG9wYWxsJ10sXHJcbiAgICAgICAgICAgIFsvXCIvLCAnc3RyaW5nJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIHN5bWJvbDogW1xyXG4gICAgICAgICAgICBbL1t7fSgpXFxbXFxdXS8sICdAYnJhY2tldHMnXSxcclxuICAgICAgICAgICAgWy9bPD5dKD8hQHN5bWJvbHMpLywgJ0BicmFja2V0cyddLFxyXG4gICAgICAgICAgICBbL1suXS8sICdkZWxpbWl0ZXInXSxcclxuICAgICAgICAgICAgWy9Ab3BlcmF0b3JzLywgJ29wZXJhdG9yJ10sXHJcbiAgICAgICAgICAgIFsvQHN5bWJvbHMvLCAnb3BlcmF0b3InXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29tbWVudDogW1xyXG4gICAgICAgICAgICBbL1xcL1xcL1xcLy4qJC8sICdjb21tZW50LmRvYyddLFxyXG4gICAgICAgICAgICBbL1xcL1xcKlxcKi8sICdjb21tZW50LmRvYycsICdAY29tbWVudGRvY2JvZHknXSxcclxuICAgICAgICAgICAgWy9cXC9cXC8uKiQvLCAnY29tbWVudCddLFxyXG4gICAgICAgICAgICBbL1xcL1xcKi8sICdjb21tZW50JywgJ0Bjb21tZW50Ym9keSddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjb21tZW50ZG9jYm9keTogW1xyXG4gICAgICAgICAgICBbL1xcL1xcKi8sICdjb21tZW50JywgJ0Bjb21tZW50Ym9keSddLFxyXG4gICAgICAgICAgICBbL1xcKlxcLy8sICdjb21tZW50LmRvYycsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvXFw6W2EtekEtWl0rXFw6LywgJ2NvbW1lbnQuZG9jLnBhcmFtJ10sXHJcbiAgICAgICAgICAgIFsvLi8sICdjb21tZW50LmRvYyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjb21tZW50Ym9keTogW1xyXG4gICAgICAgICAgICBbL1xcL1xcKi8sICdjb21tZW50JywgJ0Bjb21tZW50Ym9keSddLFxyXG4gICAgICAgICAgICBbL1xcKlxcLy8sICdjb21tZW50JywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy8uLywgJ2NvbW1lbnQnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgYXR0cmlidXRlOiBbXHJcbiAgICAgICAgICAgIFsvXFxAQGlkZW50aWZpZXIvLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BhdHRyaWJ1dGVzJzogJ2tleXdvcmQuY29udHJvbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICcnXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIGxpdGVyYWw6IFtcclxuICAgICAgICAgICAgWy9cIi8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBuZXh0OiAnQHN0cmluZ2xpdCcgfV0sXHJcbiAgICAgICAgICAgIFsvMFtiXShbMDFdXz8pKy8sICdudW1iZXIuYmluYXJ5J10sXHJcbiAgICAgICAgICAgIFsvMFtvXShbMC03XV8/KSsvLCAnbnVtYmVyLm9jdGFsJ10sXHJcbiAgICAgICAgICAgIFsvMFt4XShbMC05YS1mQS1GXV8/KSsoW3BQXVtcXC0rXShcXGRfPykrKT8vLCAnbnVtYmVyLmhleCddLFxyXG4gICAgICAgICAgICBbLyhcXGRfPykqXFwuKFxcZF8/KSsoW2VFXVtcXC0rXT8oXFxkXz8pKyk/LywgJ251bWJlci5mbG9hdCddLFxyXG4gICAgICAgICAgICBbLyhcXGRfPykrLywgJ251bWJlciddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzdHJpbmdsaXQ6IFtcclxuICAgICAgICAgICAgWy9cXFxcXFwoLywgeyB0b2tlbjogJ29wZXJhdG9yJywgbmV4dDogJ0BpbnRlcnBvbGF0ZWRleHByZXNzaW9uJyB9XSxcclxuICAgICAgICAgICAgWy9AZXNjYXBlcy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9cXFxcLi8sICdzdHJpbmcuZXNjYXBlLmludmFsaWQnXSxcclxuICAgICAgICAgICAgWy9cIi8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBuZXh0OiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIFsvLi8sICdzdHJpbmcnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgaW50ZXJwb2xhdGVkZXhwcmVzc2lvbjogW1xyXG4gICAgICAgICAgICBbL1xcKC8sIHsgdG9rZW46ICdvcGVyYXRvcicsIG5leHQ6ICdAaW50ZXJwb2xhdGVkZXhwcmVzc2lvbicgfV0sXHJcbiAgICAgICAgICAgIFsvXFwpLywgeyB0b2tlbjogJ29wZXJhdG9yJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAbGl0ZXJhbCcgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGtleXdvcmQnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BzeW1ib2wnIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIGtleXdvcmQ6IFtcclxuICAgICAgICAgICAgWy9gLywgeyB0b2tlbjogJ29wZXJhdG9yJywgbmV4dDogJ0Blc2NhcGVka2V5d29yZCcgfV0sXHJcbiAgICAgICAgICAgIFsvQGlkZW50aWZpZXIvLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6ICdrZXl3b3JkJywgJ1tBLVpdW1xcYS16QS1aMC05JF0qJzogJ3R5cGUuaWRlbnRpZmllcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBlc2NhcGVka2V5d29yZDogW1xyXG4gICAgICAgICAgICBbL2AvLCB7IHRva2VuOiAnb3BlcmF0b3InLCBuZXh0OiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIFsvLi8sICdpZGVudGlmaWVyJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vXHRcdHN5bWJvbDogW1xyXG4gICAgICAgIC8vXHRcdFx0WyAvQHN5bWJvbHMvLCAnb3BlcmF0b3InIF0sXHJcbiAgICAgICAgLy9cdFx0XHRbIC9Ab3BlcmF0b3JzLywgJ29wZXJhdG9yJyBdXHJcbiAgICAgICAgLy9cdFx0XSxcclxuICAgICAgICBpbnZva2VkbWV0aG9kOiBbXHJcbiAgICAgICAgICAgIFsvKFsuXSkoQGlkZW50aWZpZXIpLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICckMic6IFsnZGVsaW1ldGVyJywgJ3R5cGUuaWRlbnRpZmllciddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgIF1cclxuICAgIH1cclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIifQ==