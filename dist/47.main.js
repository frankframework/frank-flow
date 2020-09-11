(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[47],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/ruby/ruby.js":
/*!************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/ruby/ruby.js ***!
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
        lineComment: '#',
        blockComment: ['=begin', '=end'],
    },
    brackets: [
        ['(', ')'],
        ['{', '}'],
        ['[', ']']
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
    ],
    indentationRules: {
        increaseIndentPattern: new RegExp('^\\s*((begin|class|(private|protected)\\s+def|def|else|elsif|ensure|for|if|module|rescue|unless|until|when|while|case)|([^#]*\\sdo\\b)|([^#]*=\\s*(case|if|unless)))\\b([^#\\{;]|("|\'|\/).*\\4)*(#.*)?$'),
        decreaseIndentPattern: new RegExp('^\\s*([}\\]]([,)]?\\s*(#|$)|\\.[a-zA-Z_]\\w*\\b)|(end|rescue|ensure|else|elsif|when)\\b)'),
    }
};
/*
 * Ruby language definition
 *
 * Quite a complex language due to elaborate escape sequences
 * and quoting of literate strings/regular expressions, and
 * an 'end' keyword that does not always apply to modifiers like until and while,
 * and a 'do' keyword that sometimes starts a block, but sometimes is part of
 * another statement (like 'while').
 *
 * (1) end blocks:
 * 'end' may end declarations like if or until, but sometimes 'if' or 'until'
 * are modifiers where there is no 'end'. Also, 'do' sometimes starts a block
 * that is ended by 'end', but sometimes it is part of a 'while', 'for', or 'until'
 * To do proper brace matching we do some elaborate state manipulation.
 * some examples:
 *
 *   until bla do
 *     work until tired
 *     list.each do
 *       something if test
 *     end
 *   end
 *
 * or
 *
 * if test
 *  something (if test then x end)
 *  bar if bla
 * end
 *
 * or, how about using class as a property..
 *
 * class Test
 *   def endpoint
 *     self.class.endpoint || routes
 *   end
 * end
 *
 * (2) quoting:
 * there are many kinds of strings and escape sequences. But also, one can
 * start many string-like things as '%qx' where q specifies the kind of string
 * (like a command, escape expanded, regular expression, symbol etc.), and x is
 * some character and only another 'x' ends the sequence. Except for brackets
 * where the closing bracket ends the sequence.. and except for a nested bracket
 * inside the string like entity. Also, such strings can contain interpolated
 * ruby expressions again (and span multiple lines). Moreover, expanded
 * regular expression can also contain comments.
 */
var language = {
    tokenPostfix: '.ruby',
    keywords: [
        '__LINE__', '__ENCODING__', '__FILE__', 'BEGIN', 'END', 'alias', 'and', 'begin',
        'break', 'case', 'class', 'def', 'defined?', 'do', 'else', 'elsif', 'end',
        'ensure', 'for', 'false', 'if', 'in', 'module', 'next', 'nil', 'not', 'or', 'redo',
        'rescue', 'retry', 'return', 'self', 'super', 'then', 'true', 'undef', 'unless',
        'until', 'when', 'while', 'yield',
    ],
    keywordops: [
        '::', '..', '...', '?', ':', '=>'
    ],
    builtins: [
        'require', 'public', 'private', 'include', 'extend', 'attr_reader',
        'protected', 'private_class_method', 'protected_class_method', 'new'
    ],
    // these are closed by 'end' (if, while and until are handled separately)
    declarations: [
        'module', 'class', 'def', 'case', 'do', 'begin', 'for', 'if', 'while', 'until', 'unless'
    ],
    linedecls: [
        'def', 'case', 'do', 'begin', 'for', 'if', 'while', 'until', 'unless'
    ],
    operators: [
        '^', '&', '|', '<=>', '==', '===', '!~', '=~', '>', '>=', '<', '<=', '<<', '>>', '+',
        '-', '*', '/', '%', '**', '~', '+@', '-@', '[]', '[]=', '`',
        '+=', '-=', '*=', '**=', '/=', '^=', '%=', '<<=', '>>=', '&=', '&&=', '||=', '|='
    ],
    brackets: [
        { open: '(', close: ')', token: 'delimiter.parenthesis' },
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.square' }
    ],
    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%\.]+/,
    // escape sequences
    escape: /(?:[abefnrstv\\"'\n\r]|[0-7]{1,3}|x[0-9A-Fa-f]{1,2}|u[0-9A-Fa-f]{4})/,
    escapes: /\\(?:C\-(@escape|.)|c(@escape|.)|@escape)/,
    decpart: /\d(_?\d)*/,
    decimal: /0|@decpart/,
    delim: /[^a-zA-Z0-9\s\n\r]/,
    heredelim: /(?:\w+|'[^']*'|"[^"]*"|`[^`]*`)/,
    regexpctl: /[(){}\[\]\$\^|\-*+?\.]/,
    regexpesc: /\\(?:[AzZbBdDfnrstvwWn0\\\/]|@regexpctl|c[A-Z]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})?/,
    // The main tokenizer for our languages
    tokenizer: {
        // Main entry.
        // root.<decl> where decl is the current opening declaration (like 'class')
        root: [
            // identifiers and keywords
            // most complexity here is due to matching 'end' correctly with declarations.
            // We distinguish a declaration that comes first on a line, versus declarations further on a line (which are most likey modifiers)
            [/^(\s*)([a-z_]\w*[!?=]?)/, ['white',
                    {
                        cases: {
                            'for|until|while': { token: 'keyword.$2', next: '@dodecl.$2' },
                            '@declarations': { token: 'keyword.$2', next: '@root.$2' },
                            'end': { token: 'keyword.$S2', next: '@pop' },
                            '@keywords': 'keyword',
                            '@builtins': 'predefined',
                            '@default': 'identifier'
                        }
                    }]],
            [/[a-z_]\w*[!?=]?/,
                {
                    cases: {
                        'if|unless|while|until': { token: 'keyword.$0x', next: '@modifier.$0x' },
                        'for': { token: 'keyword.$2', next: '@dodecl.$2' },
                        '@linedecls': { token: 'keyword.$0', next: '@root.$0' },
                        'end': { token: 'keyword.$S2', next: '@pop' },
                        '@keywords': 'keyword',
                        '@builtins': 'predefined',
                        '@default': 'identifier'
                    }
                }],
            [/[A-Z][\w]*[!?=]?/, 'constructor.identifier'],
            [/\$[\w]*/, 'global.constant'],
            [/@[\w]*/, 'namespace.instance.identifier'],
            [/@@[\w]*/, 'namespace.class.identifier'],
            // here document
            [/<<[-~](@heredelim).*/, { token: 'string.heredoc.delimiter', next: '@heredoc.$1' }],
            [/[ \t\r\n]+<<(@heredelim).*/, { token: 'string.heredoc.delimiter', next: '@heredoc.$1' }],
            [/^<<(@heredelim).*/, { token: 'string.heredoc.delimiter', next: '@heredoc.$1' }],
            // whitespace
            { include: '@whitespace' },
            // strings
            [/"/, { token: 'string.d.delim', next: '@dstring.d."' }],
            [/'/, { token: 'string.sq.delim', next: '@sstring.sq' }],
            // % literals. For efficiency, rematch in the 'pstring' state
            [/%([rsqxwW]|Q?)/, { token: '@rematch', next: 'pstring' }],
            // commands and symbols
            [/`/, { token: 'string.x.delim', next: '@dstring.x.`' }],
            [/:(\w|[$@])\w*[!?=]?/, 'string.s'],
            [/:"/, { token: 'string.s.delim', next: '@dstring.s."' }],
            [/:'/, { token: 'string.s.delim', next: '@sstring.s' }],
            // regular expressions. Lookahead for a (not escaped) closing forwardslash on the same line
            [/\/(?=(\\\/|[^\/\n])+\/)/, { token: 'regexp.delim', next: '@regexp' }],
            // delimiters and operators
            [/[{}()\[\]]/, '@brackets'],
            [/@symbols/, {
                    cases: {
                        '@keywordops': 'keyword',
                        '@operators': 'operator',
                        '@default': ''
                    }
                }],
            [/[;,]/, 'delimiter'],
            // numbers
            [/0[xX][0-9a-fA-F](_?[0-9a-fA-F])*/, 'number.hex'],
            [/0[_oO][0-7](_?[0-7])*/, 'number.octal'],
            [/0[bB][01](_?[01])*/, 'number.binary'],
            [/0[dD]@decpart/, 'number'],
            [/@decimal((\.@decpart)?([eE][\-+]?@decpart)?)/, {
                    cases: {
                        '$1': 'number.float',
                        '@default': 'number'
                    }
                }],
        ],
        // used to not treat a 'do' as a block opener if it occurs on the same
        // line as a 'do' statement: 'while|until|for'
        // dodecl.<decl> where decl is the declarations started, like 'while'
        dodecl: [
            [/^/, { token: '', switchTo: '@root.$S2' }],
            [/[a-z_]\w*[!?=]?/, {
                    cases: {
                        'end': { token: 'keyword.$S2', next: '@pop' },
                        'do': { token: 'keyword', switchTo: '@root.$S2' },
                        '@linedecls': { token: '@rematch', switchTo: '@root.$S2' },
                        '@keywords': 'keyword',
                        '@builtins': 'predefined',
                        '@default': 'identifier'
                    }
                }],
            { include: '@root' }
        ],
        // used to prevent potential modifiers ('if|until|while|unless') to match
        // with 'end' keywords.
        // modifier.<decl>x where decl is the declaration starter, like 'if'
        modifier: [
            [/^/, '', '@pop'],
            [/[a-z_]\w*[!?=]?/, {
                    cases: {
                        'end': { token: 'keyword.$S2', next: '@pop' },
                        'then|else|elsif|do': { token: 'keyword', switchTo: '@root.$S2' },
                        '@linedecls': { token: '@rematch', switchTo: '@root.$S2' },
                        '@keywords': 'keyword',
                        '@builtins': 'predefined',
                        '@default': 'identifier'
                    }
                }],
            { include: '@root' }
        ],
        // single quote strings (also used for symbols)
        // sstring.<kind>  where kind is 'sq' (single quote) or 's' (symbol)
        sstring: [
            [/[^\\']+/, 'string.$S2'],
            [/\\\\|\\'|\\$/, 'string.$S2.escape'],
            [/\\./, 'string.$S2.invalid'],
            [/'/, { token: 'string.$S2.delim', next: '@pop' }]
        ],
        // double quoted "string".
        // dstring.<kind>.<delim> where kind is 'd' (double quoted), 'x' (command), or 's' (symbol)
        // and delim is the ending delimiter (" or `)
        dstring: [
            [/[^\\`"#]+/, 'string.$S2'],
            [/#/, 'string.$S2.escape', '@interpolated'],
            [/\\$/, 'string.$S2.escape'],
            [/@escapes/, 'string.$S2.escape'],
            [/\\./, 'string.$S2.escape.invalid'],
            [/[`"]/, {
                    cases: {
                        '$#==$S3': { token: 'string.$S2.delim', next: '@pop' },
                        '@default': 'string.$S2'
                    }
                }]
        ],
        // literal documents
        // heredoc.<close> where close is the closing delimiter
        heredoc: [
            [/^(\s*)(@heredelim)$/, {
                    cases: {
                        '$2==$S2': ['string.heredoc', { token: 'string.heredoc.delimiter', next: '@pop' }],
                        '@default': ['string.heredoc', 'string.heredoc']
                    }
                }],
            [/.*/, 'string.heredoc'],
        ],
        // interpolated sequence
        interpolated: [
            [/\$\w*/, 'global.constant', '@pop'],
            [/@\w*/, 'namespace.class.identifier', '@pop'],
            [/@@\w*/, 'namespace.instance.identifier', '@pop'],
            [/[{]/, { token: 'string.escape.curly', switchTo: '@interpolated_compound' }],
            ['', '', '@pop'],
        ],
        // any code
        interpolated_compound: [
            [/[}]/, { token: 'string.escape.curly', next: '@pop' }],
            { include: '@root' },
        ],
        // %r quoted regexp
        // pregexp.<open>.<close> where open/close are the open/close delimiter
        pregexp: [
            { include: '@whitespace' },
            // turns out that you can quote using regex control characters, aargh!
            // for example; %r|kgjgaj| is ok (even though | is used for alternation)
            // so, we need to match those first
            [/[^\(\{\[\\]/, {
                    cases: {
                        '$#==$S3': { token: 'regexp.delim', next: '@pop' },
                        '$#==$S2': { token: 'regexp.delim', next: '@push' },
                        '~[)}\\]]': '@brackets.regexp.escape.control',
                        '~@regexpctl': 'regexp.escape.control',
                        '@default': 'regexp'
                    }
                }],
            { include: '@regexcontrol' },
        ],
        // We match regular expression quite precisely
        regexp: [
            { include: '@regexcontrol' },
            [/[^\\\/]/, 'regexp'],
            ['/[ixmp]*', { token: 'regexp.delim' }, '@pop'],
        ],
        regexcontrol: [
            [/(\{)(\d+(?:,\d*)?)(\})/, ['@brackets.regexp.escape.control', 'regexp.escape.control', '@brackets.regexp.escape.control']],
            [/(\[)(\^?)/, ['@brackets.regexp.escape.control', { token: 'regexp.escape.control', next: '@regexrange' }]],
            [/(\()(\?[:=!])/, ['@brackets.regexp.escape.control', 'regexp.escape.control']],
            [/\(\?#/, { token: 'regexp.escape.control', next: '@regexpcomment' }],
            [/[()]/, '@brackets.regexp.escape.control'],
            [/@regexpctl/, 'regexp.escape.control'],
            [/\\$/, 'regexp.escape'],
            [/@regexpesc/, 'regexp.escape'],
            [/\\\./, 'regexp.invalid'],
            [/#/, 'regexp.escape', '@interpolated'],
        ],
        regexrange: [
            [/-/, 'regexp.escape.control'],
            [/\^/, 'regexp.invalid'],
            [/\\$/, 'regexp.escape'],
            [/@regexpesc/, 'regexp.escape'],
            [/[^\]]/, 'regexp'],
            [/\]/, '@brackets.regexp.escape.control', '@pop'],
        ],
        regexpcomment: [
            [/[^)]+/, 'comment'],
            [/\)/, { token: 'regexp.escape.control', next: '@pop' }]
        ],
        // % quoted strings
        // A bit repetitive since we need to often special case the kind of ending delimiter
        pstring: [
            [/%([qws])\(/, { token: 'string.$1.delim', switchTo: '@qstring.$1.(.)' }],
            [/%([qws])\[/, { token: 'string.$1.delim', switchTo: '@qstring.$1.[.]' }],
            [/%([qws])\{/, { token: 'string.$1.delim', switchTo: '@qstring.$1.{.}' }],
            [/%([qws])</, { token: 'string.$1.delim', switchTo: '@qstring.$1.<.>' }],
            [/%([qws])(@delim)/, { token: 'string.$1.delim', switchTo: '@qstring.$1.$2.$2' }],
            [/%r\(/, { token: 'regexp.delim', switchTo: '@pregexp.(.)' }],
            [/%r\[/, { token: 'regexp.delim', switchTo: '@pregexp.[.]' }],
            [/%r\{/, { token: 'regexp.delim', switchTo: '@pregexp.{.}' }],
            [/%r</, { token: 'regexp.delim', switchTo: '@pregexp.<.>' }],
            [/%r(@delim)/, { token: 'regexp.delim', switchTo: '@pregexp.$1.$1' }],
            [/%(x|W|Q?)\(/, { token: 'string.$1.delim', switchTo: '@qqstring.$1.(.)' }],
            [/%(x|W|Q?)\[/, { token: 'string.$1.delim', switchTo: '@qqstring.$1.[.]' }],
            [/%(x|W|Q?)\{/, { token: 'string.$1.delim', switchTo: '@qqstring.$1.{.}' }],
            [/%(x|W|Q?)</, { token: 'string.$1.delim', switchTo: '@qqstring.$1.<.>' }],
            [/%(x|W|Q?)(@delim)/, { token: 'string.$1.delim', switchTo: '@qqstring.$1.$2.$2' }],
            [/%([rqwsxW]|Q?)./, { token: 'invalid', next: '@pop' }],
            [/./, { token: 'invalid', next: '@pop' }],
        ],
        // non-expanded quoted string.
        // qstring.<kind>.<open>.<close>
        //  kind = q|w|s  (single quote, array, symbol)
        //  open = open delimiter
        //  close = close delimiter
        qstring: [
            [/\\$/, 'string.$S2.escape'],
            [/\\./, 'string.$S2.escape'],
            [/./, {
                    cases: {
                        '$#==$S4': { token: 'string.$S2.delim', next: '@pop' },
                        '$#==$S3': { token: 'string.$S2.delim', next: '@push' },
                        '@default': 'string.$S2'
                    }
                }],
        ],
        // expanded quoted string.
        // qqstring.<kind>.<open>.<close>
        //  kind = Q|W|x  (double quote, array, command)
        //  open = open delimiter
        //  close = close delimiter
        qqstring: [
            [/#/, 'string.$S2.escape', '@interpolated'],
            { include: '@qstring' }
        ],
        // whitespace & comments
        whitespace: [
            [/[ \t\r\n]+/, ''],
            [/^\s*=begin\b/, 'comment', '@comment'],
            [/#.*$/, 'comment'],
        ],
        comment: [
            [/[^=]+/, 'comment'],
            [/^\s*=begin\b/, 'comment.invalid'],
            [/^\s*=end\b.*/, 'comment', '@pop'],
            [/[=]/, 'comment']
        ],
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3J1YnkvcnVieS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxXQUFXLEtBQUs7QUFDaEI7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ0EsME5BQTBOO0FBQzFOLG1EQUFtRDtBQUNuRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsd0RBQXdEO0FBQ2pFLFNBQVMsU0FBUyxZQUFZLDZCQUE2QjtBQUMzRCxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQSwwQ0FBMEMsSUFBSSxjQUFjLElBQUksY0FBYyxFQUFFO0FBQ2hGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQkFBcUI7QUFDckIsNEVBQTRFLEVBQUUsY0FBYyxFQUFFO0FBQzlGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnREFBZ0QsMENBQTBDO0FBQzFGLDhDQUE4Qyx3Q0FBd0M7QUFDdEYsb0NBQW9DLHFDQUFxQztBQUN6RTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQjtBQUNyQjtBQUNBO0FBQ0E7QUFDQSxrREFBa0QsOENBQThDO0FBQ2hHLGdDQUFnQywwQ0FBMEM7QUFDMUUsdUNBQXVDLHdDQUF3QztBQUMvRSxnQ0FBZ0MscUNBQXFDO0FBQ3JFO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQ0FBc0MseURBQXlEO0FBQy9GLDRDQUE0Qyx5REFBeUQ7QUFDckcsbUNBQW1DLHlEQUF5RDtBQUM1RjtBQUNBLGFBQWEseUJBQXlCO0FBQ3RDO0FBQ0EsbUJBQW1CLGdEQUFnRDtBQUNuRSxtQkFBbUIsZ0RBQWdEO0FBQ25FO0FBQ0EsZ0NBQWdDLHFDQUFxQztBQUNyRTtBQUNBLG1CQUFtQixnREFBZ0Q7QUFDbkU7QUFDQSxvQkFBb0IsZ0RBQWdEO0FBQ3BFLG9CQUFvQiw4Q0FBOEM7QUFDbEU7QUFDQSx5Q0FBeUMseUNBQXlDO0FBQ2xGO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQixnQkFBZ0I7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQixtQ0FBbUM7QUFDdEQ7QUFDQTtBQUNBLGdDQUFnQyxxQ0FBcUM7QUFDckUsK0JBQStCLDBDQUEwQztBQUN6RSx1Q0FBdUMsMkNBQTJDO0FBQ2xGO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCLGFBQWE7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0NBQWdDLHFDQUFxQztBQUNyRSwrQ0FBK0MsMENBQTBDO0FBQ3pGLHVDQUF1QywyQ0FBMkM7QUFDbEY7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakIsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLDBDQUEwQztBQUM3RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvQ0FBb0MsMENBQTBDO0FBQzlFO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdURBQXVELGtEQUFrRDtBQUN6RztBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWdCLEtBQUssbUVBQW1FO0FBQ3hGO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWdCLEtBQUssNkNBQTZDO0FBQ2xFLGFBQWEsbUJBQW1CO0FBQ2hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBYSx5QkFBeUI7QUFDdEM7QUFDQSwyQkFBMkI7QUFDM0I7QUFDQSxvQkFBb0I7QUFDcEI7QUFDQSxvQ0FBb0Msc0NBQXNDO0FBQzFFLG9DQUFvQyx1Q0FBdUM7QUFDM0UsNkJBQTZCO0FBQzdCO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQixhQUFhLDJCQUEyQjtBQUN4QztBQUNBO0FBQ0E7QUFDQSxhQUFhLDJCQUEyQjtBQUN4QztBQUNBLDBCQUEwQix3QkFBd0I7QUFDbEQ7QUFDQTtBQUNBLGlCQUFpQixrQkFBa0I7QUFDbkMsK0RBQStELHNEQUFzRDtBQUNySDtBQUNBLHVCQUF1Qix5REFBeUQ7QUFDaEY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFvQiwrQ0FBK0M7QUFDbkU7QUFDQTtBQUNBO0FBQ0E7QUFDQSw0QkFBNEIsd0RBQXdEO0FBQ3BGLDRCQUE0Qix3REFBd0Q7QUFDcEYsd0JBQXdCLElBQUksbURBQW1ELEVBQUUsR0FBRztBQUNwRiwyQkFBMkIsd0RBQXdEO0FBQ25GLGtDQUFrQywwREFBMEQ7QUFDNUYsc0JBQXNCLGtEQUFrRDtBQUN4RSxzQkFBc0Isa0RBQWtEO0FBQ3hFLGtCQUFrQixJQUFJLDZDQUE2QyxFQUFFLEdBQUc7QUFDeEUscUJBQXFCLGtEQUFrRDtBQUN2RSw0QkFBNEIsb0RBQW9EO0FBQ2hGLDZCQUE2Qix5REFBeUQ7QUFDdEYsNkJBQTZCLHlEQUF5RDtBQUN0Rix5QkFBeUIsSUFBSSxvREFBb0QsRUFBRSxHQUFHO0FBQ3RGLDRCQUE0Qix5REFBeUQ7QUFDckYsbUNBQW1DLDJEQUEyRDtBQUM5RixpQ0FBaUMsaUNBQWlDO0FBQ2xFLG1CQUFtQixpQ0FBaUM7QUFDcEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9DQUFvQywwQ0FBMEM7QUFDOUUsb0NBQW9DLDJDQUEyQztBQUMvRTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IjQ3Lm1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5leHBvcnQgdmFyIGNvbmYgPSB7XHJcbiAgICBjb21tZW50czoge1xyXG4gICAgICAgIGxpbmVDb21tZW50OiAnIycsXHJcbiAgICAgICAgYmxvY2tDb21tZW50OiBbJz1iZWdpbicsICc9ZW5kJ10sXHJcbiAgICB9LFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICBbJygnLCAnKSddLFxyXG4gICAgICAgIFsneycsICd9J10sXHJcbiAgICAgICAgWydbJywgJ10nXVxyXG4gICAgXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgIF0sXHJcbiAgICBpbmRlbnRhdGlvblJ1bGVzOiB7XHJcbiAgICAgICAgaW5jcmVhc2VJbmRlbnRQYXR0ZXJuOiBuZXcgUmVnRXhwKCdeXFxcXHMqKChiZWdpbnxjbGFzc3wocHJpdmF0ZXxwcm90ZWN0ZWQpXFxcXHMrZGVmfGRlZnxlbHNlfGVsc2lmfGVuc3VyZXxmb3J8aWZ8bW9kdWxlfHJlc2N1ZXx1bmxlc3N8dW50aWx8d2hlbnx3aGlsZXxjYXNlKXwoW14jXSpcXFxcc2RvXFxcXGIpfChbXiNdKj1cXFxccyooY2FzZXxpZnx1bmxlc3MpKSlcXFxcYihbXiNcXFxceztdfChcInxcXCd8XFwvKS4qXFxcXDQpKigjLiopPyQnKSxcclxuICAgICAgICBkZWNyZWFzZUluZGVudFBhdHRlcm46IG5ldyBSZWdFeHAoJ15cXFxccyooW31cXFxcXV0oWywpXT9cXFxccyooI3wkKXxcXFxcLlthLXpBLVpfXVxcXFx3KlxcXFxiKXwoZW5kfHJlc2N1ZXxlbnN1cmV8ZWxzZXxlbHNpZnx3aGVuKVxcXFxiKScpLFxyXG4gICAgfVxyXG59O1xyXG4vKlxyXG4gKiBSdWJ5IGxhbmd1YWdlIGRlZmluaXRpb25cclxuICpcclxuICogUXVpdGUgYSBjb21wbGV4IGxhbmd1YWdlIGR1ZSB0byBlbGFib3JhdGUgZXNjYXBlIHNlcXVlbmNlc1xyXG4gKiBhbmQgcXVvdGluZyBvZiBsaXRlcmF0ZSBzdHJpbmdzL3JlZ3VsYXIgZXhwcmVzc2lvbnMsIGFuZFxyXG4gKiBhbiAnZW5kJyBrZXl3b3JkIHRoYXQgZG9lcyBub3QgYWx3YXlzIGFwcGx5IHRvIG1vZGlmaWVycyBsaWtlIHVudGlsIGFuZCB3aGlsZSxcclxuICogYW5kIGEgJ2RvJyBrZXl3b3JkIHRoYXQgc29tZXRpbWVzIHN0YXJ0cyBhIGJsb2NrLCBidXQgc29tZXRpbWVzIGlzIHBhcnQgb2ZcclxuICogYW5vdGhlciBzdGF0ZW1lbnQgKGxpa2UgJ3doaWxlJykuXHJcbiAqXHJcbiAqICgxKSBlbmQgYmxvY2tzOlxyXG4gKiAnZW5kJyBtYXkgZW5kIGRlY2xhcmF0aW9ucyBsaWtlIGlmIG9yIHVudGlsLCBidXQgc29tZXRpbWVzICdpZicgb3IgJ3VudGlsJ1xyXG4gKiBhcmUgbW9kaWZpZXJzIHdoZXJlIHRoZXJlIGlzIG5vICdlbmQnLiBBbHNvLCAnZG8nIHNvbWV0aW1lcyBzdGFydHMgYSBibG9ja1xyXG4gKiB0aGF0IGlzIGVuZGVkIGJ5ICdlbmQnLCBidXQgc29tZXRpbWVzIGl0IGlzIHBhcnQgb2YgYSAnd2hpbGUnLCAnZm9yJywgb3IgJ3VudGlsJ1xyXG4gKiBUbyBkbyBwcm9wZXIgYnJhY2UgbWF0Y2hpbmcgd2UgZG8gc29tZSBlbGFib3JhdGUgc3RhdGUgbWFuaXB1bGF0aW9uLlxyXG4gKiBzb21lIGV4YW1wbGVzOlxyXG4gKlxyXG4gKiAgIHVudGlsIGJsYSBkb1xyXG4gKiAgICAgd29yayB1bnRpbCB0aXJlZFxyXG4gKiAgICAgbGlzdC5lYWNoIGRvXHJcbiAqICAgICAgIHNvbWV0aGluZyBpZiB0ZXN0XHJcbiAqICAgICBlbmRcclxuICogICBlbmRcclxuICpcclxuICogb3JcclxuICpcclxuICogaWYgdGVzdFxyXG4gKiAgc29tZXRoaW5nIChpZiB0ZXN0IHRoZW4geCBlbmQpXHJcbiAqICBiYXIgaWYgYmxhXHJcbiAqIGVuZFxyXG4gKlxyXG4gKiBvciwgaG93IGFib3V0IHVzaW5nIGNsYXNzIGFzIGEgcHJvcGVydHkuLlxyXG4gKlxyXG4gKiBjbGFzcyBUZXN0XHJcbiAqICAgZGVmIGVuZHBvaW50XHJcbiAqICAgICBzZWxmLmNsYXNzLmVuZHBvaW50IHx8IHJvdXRlc1xyXG4gKiAgIGVuZFxyXG4gKiBlbmRcclxuICpcclxuICogKDIpIHF1b3Rpbmc6XHJcbiAqIHRoZXJlIGFyZSBtYW55IGtpbmRzIG9mIHN0cmluZ3MgYW5kIGVzY2FwZSBzZXF1ZW5jZXMuIEJ1dCBhbHNvLCBvbmUgY2FuXHJcbiAqIHN0YXJ0IG1hbnkgc3RyaW5nLWxpa2UgdGhpbmdzIGFzICclcXgnIHdoZXJlIHEgc3BlY2lmaWVzIHRoZSBraW5kIG9mIHN0cmluZ1xyXG4gKiAobGlrZSBhIGNvbW1hbmQsIGVzY2FwZSBleHBhbmRlZCwgcmVndWxhciBleHByZXNzaW9uLCBzeW1ib2wgZXRjLiksIGFuZCB4IGlzXHJcbiAqIHNvbWUgY2hhcmFjdGVyIGFuZCBvbmx5IGFub3RoZXIgJ3gnIGVuZHMgdGhlIHNlcXVlbmNlLiBFeGNlcHQgZm9yIGJyYWNrZXRzXHJcbiAqIHdoZXJlIHRoZSBjbG9zaW5nIGJyYWNrZXQgZW5kcyB0aGUgc2VxdWVuY2UuLiBhbmQgZXhjZXB0IGZvciBhIG5lc3RlZCBicmFja2V0XHJcbiAqIGluc2lkZSB0aGUgc3RyaW5nIGxpa2UgZW50aXR5LiBBbHNvLCBzdWNoIHN0cmluZ3MgY2FuIGNvbnRhaW4gaW50ZXJwb2xhdGVkXHJcbiAqIHJ1YnkgZXhwcmVzc2lvbnMgYWdhaW4gKGFuZCBzcGFuIG11bHRpcGxlIGxpbmVzKS4gTW9yZW92ZXIsIGV4cGFuZGVkXHJcbiAqIHJlZ3VsYXIgZXhwcmVzc2lvbiBjYW4gYWxzbyBjb250YWluIGNvbW1lbnRzLlxyXG4gKi9cclxuZXhwb3J0IHZhciBsYW5ndWFnZSA9IHtcclxuICAgIHRva2VuUG9zdGZpeDogJy5ydWJ5JyxcclxuICAgIGtleXdvcmRzOiBbXHJcbiAgICAgICAgJ19fTElORV9fJywgJ19fRU5DT0RJTkdfXycsICdfX0ZJTEVfXycsICdCRUdJTicsICdFTkQnLCAnYWxpYXMnLCAnYW5kJywgJ2JlZ2luJyxcclxuICAgICAgICAnYnJlYWsnLCAnY2FzZScsICdjbGFzcycsICdkZWYnLCAnZGVmaW5lZD8nLCAnZG8nLCAnZWxzZScsICdlbHNpZicsICdlbmQnLFxyXG4gICAgICAgICdlbnN1cmUnLCAnZm9yJywgJ2ZhbHNlJywgJ2lmJywgJ2luJywgJ21vZHVsZScsICduZXh0JywgJ25pbCcsICdub3QnLCAnb3InLCAncmVkbycsXHJcbiAgICAgICAgJ3Jlc2N1ZScsICdyZXRyeScsICdyZXR1cm4nLCAnc2VsZicsICdzdXBlcicsICd0aGVuJywgJ3RydWUnLCAndW5kZWYnLCAndW5sZXNzJyxcclxuICAgICAgICAndW50aWwnLCAnd2hlbicsICd3aGlsZScsICd5aWVsZCcsXHJcbiAgICBdLFxyXG4gICAga2V5d29yZG9wczogW1xyXG4gICAgICAgICc6OicsICcuLicsICcuLi4nLCAnPycsICc6JywgJz0+J1xyXG4gICAgXSxcclxuICAgIGJ1aWx0aW5zOiBbXHJcbiAgICAgICAgJ3JlcXVpcmUnLCAncHVibGljJywgJ3ByaXZhdGUnLCAnaW5jbHVkZScsICdleHRlbmQnLCAnYXR0cl9yZWFkZXInLFxyXG4gICAgICAgICdwcm90ZWN0ZWQnLCAncHJpdmF0ZV9jbGFzc19tZXRob2QnLCAncHJvdGVjdGVkX2NsYXNzX21ldGhvZCcsICduZXcnXHJcbiAgICBdLFxyXG4gICAgLy8gdGhlc2UgYXJlIGNsb3NlZCBieSAnZW5kJyAoaWYsIHdoaWxlIGFuZCB1bnRpbCBhcmUgaGFuZGxlZCBzZXBhcmF0ZWx5KVxyXG4gICAgZGVjbGFyYXRpb25zOiBbXHJcbiAgICAgICAgJ21vZHVsZScsICdjbGFzcycsICdkZWYnLCAnY2FzZScsICdkbycsICdiZWdpbicsICdmb3InLCAnaWYnLCAnd2hpbGUnLCAndW50aWwnLCAndW5sZXNzJ1xyXG4gICAgXSxcclxuICAgIGxpbmVkZWNsczogW1xyXG4gICAgICAgICdkZWYnLCAnY2FzZScsICdkbycsICdiZWdpbicsICdmb3InLCAnaWYnLCAnd2hpbGUnLCAndW50aWwnLCAndW5sZXNzJ1xyXG4gICAgXSxcclxuICAgIG9wZXJhdG9yczogW1xyXG4gICAgICAgICdeJywgJyYnLCAnfCcsICc8PT4nLCAnPT0nLCAnPT09JywgJyF+JywgJz1+JywgJz4nLCAnPj0nLCAnPCcsICc8PScsICc8PCcsICc+PicsICcrJyxcclxuICAgICAgICAnLScsICcqJywgJy8nLCAnJScsICcqKicsICd+JywgJytAJywgJy1AJywgJ1tdJywgJ1tdPScsICdgJyxcclxuICAgICAgICAnKz0nLCAnLT0nLCAnKj0nLCAnKio9JywgJy89JywgJ149JywgJyU9JywgJzw8PScsICc+Pj0nLCAnJj0nLCAnJiY9JywgJ3x8PScsICd8PSdcclxuICAgIF0sXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknLCB0b2tlbjogJ2RlbGltaXRlci5wYXJlbnRoZXNpcycgfSxcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JywgdG9rZW46ICdkZWxpbWl0ZXIuY3VybHknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScsIHRva2VuOiAnZGVsaW1pdGVyLnNxdWFyZScgfVxyXG4gICAgXSxcclxuICAgIC8vIHdlIGluY2x1ZGUgdGhlc2UgY29tbW9uIHJlZ3VsYXIgZXhwcmVzc2lvbnNcclxuICAgIHN5bWJvbHM6IC9bPT48IX4/OiZ8K1xcLSpcXC9cXF4lXFwuXSsvLFxyXG4gICAgLy8gZXNjYXBlIHNlcXVlbmNlc1xyXG4gICAgZXNjYXBlOiAvKD86W2FiZWZucnN0dlxcXFxcIidcXG5cXHJdfFswLTddezEsM318eFswLTlBLUZhLWZdezEsMn18dVswLTlBLUZhLWZdezR9KS8sXHJcbiAgICBlc2NhcGVzOiAvXFxcXCg/OkNcXC0oQGVzY2FwZXwuKXxjKEBlc2NhcGV8Lil8QGVzY2FwZSkvLFxyXG4gICAgZGVjcGFydDogL1xcZChfP1xcZCkqLyxcclxuICAgIGRlY2ltYWw6IC8wfEBkZWNwYXJ0LyxcclxuICAgIGRlbGltOiAvW15hLXpBLVowLTlcXHNcXG5cXHJdLyxcclxuICAgIGhlcmVkZWxpbTogLyg/Olxcdyt8J1teJ10qJ3xcIlteXCJdKlwifGBbXmBdKmApLyxcclxuICAgIHJlZ2V4cGN0bDogL1soKXt9XFxbXFxdXFwkXFxefFxcLSorP1xcLl0vLFxyXG4gICAgcmVnZXhwZXNjOiAvXFxcXCg/OltBelpiQmREZm5yc3R2d1duMFxcXFxcXC9dfEByZWdleHBjdGx8Y1tBLVpdfHhbMC05YS1mQS1GXXsyfXx1WzAtOWEtZkEtRl17NH0pPy8sXHJcbiAgICAvLyBUaGUgbWFpbiB0b2tlbml6ZXIgZm9yIG91ciBsYW5ndWFnZXNcclxuICAgIHRva2VuaXplcjoge1xyXG4gICAgICAgIC8vIE1haW4gZW50cnkuXHJcbiAgICAgICAgLy8gcm9vdC48ZGVjbD4gd2hlcmUgZGVjbCBpcyB0aGUgY3VycmVudCBvcGVuaW5nIGRlY2xhcmF0aW9uIChsaWtlICdjbGFzcycpXHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICAvLyBpZGVudGlmaWVycyBhbmQga2V5d29yZHNcclxuICAgICAgICAgICAgLy8gbW9zdCBjb21wbGV4aXR5IGhlcmUgaXMgZHVlIHRvIG1hdGNoaW5nICdlbmQnIGNvcnJlY3RseSB3aXRoIGRlY2xhcmF0aW9ucy5cclxuICAgICAgICAgICAgLy8gV2UgZGlzdGluZ3Vpc2ggYSBkZWNsYXJhdGlvbiB0aGF0IGNvbWVzIGZpcnN0IG9uIGEgbGluZSwgdmVyc3VzIGRlY2xhcmF0aW9ucyBmdXJ0aGVyIG9uIGEgbGluZSAod2hpY2ggYXJlIG1vc3QgbGlrZXkgbW9kaWZpZXJzKVxyXG4gICAgICAgICAgICBbL14oXFxzKikoW2Etel9dXFx3KlshPz1dPykvLCBbJ3doaXRlJyxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZm9yfHVudGlsfHdoaWxlJzogeyB0b2tlbjogJ2tleXdvcmQuJDInLCBuZXh0OiAnQGRvZGVjbC4kMicgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdAZGVjbGFyYXRpb25zJzogeyB0b2tlbjogJ2tleXdvcmQuJDInLCBuZXh0OiAnQHJvb3QuJDInIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZW5kJzogeyB0b2tlbjogJ2tleXdvcmQuJFMyJywgbmV4dDogJ0Bwb3AnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogJ2tleXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0BidWlsdGlucyc6ICdwcmVkZWZpbmVkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfV1dLFxyXG4gICAgICAgICAgICBbL1thLXpfXVxcdypbIT89XT8vLFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdpZnx1bmxlc3N8d2hpbGV8dW50aWwnOiB7IHRva2VuOiAna2V5d29yZC4kMHgnLCBuZXh0OiAnQG1vZGlmaWVyLiQweCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Zvcic6IHsgdG9rZW46ICdrZXl3b3JkLiQyJywgbmV4dDogJ0Bkb2RlY2wuJDInIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAbGluZWRlY2xzJzogeyB0b2tlbjogJ2tleXdvcmQuJDAnLCBuZXh0OiAnQHJvb3QuJDAnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdlbmQnOiB7IHRva2VuOiAna2V5d29yZC4kUzInLCBuZXh0OiAnQHBvcCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BidWlsdGlucyc6ICdwcmVkZWZpbmVkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ2lkZW50aWZpZXInXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgIFsvW0EtWl1bXFx3XSpbIT89XT8vLCAnY29uc3RydWN0b3IuaWRlbnRpZmllciddLFxyXG4gICAgICAgICAgICBbL1xcJFtcXHddKi8sICdnbG9iYWwuY29uc3RhbnQnXSxcclxuICAgICAgICAgICAgWy9AW1xcd10qLywgJ25hbWVzcGFjZS5pbnN0YW5jZS5pZGVudGlmaWVyJ10sXHJcbiAgICAgICAgICAgIFsvQEBbXFx3XSovLCAnbmFtZXNwYWNlLmNsYXNzLmlkZW50aWZpZXInXSxcclxuICAgICAgICAgICAgLy8gaGVyZSBkb2N1bWVudFxyXG4gICAgICAgICAgICBbLzw8Wy1+XShAaGVyZWRlbGltKS4qLywgeyB0b2tlbjogJ3N0cmluZy5oZXJlZG9jLmRlbGltaXRlcicsIG5leHQ6ICdAaGVyZWRvYy4kMScgfV0sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKzw8KEBoZXJlZGVsaW0pLiovLCB7IHRva2VuOiAnc3RyaW5nLmhlcmVkb2MuZGVsaW1pdGVyJywgbmV4dDogJ0BoZXJlZG9jLiQxJyB9XSxcclxuICAgICAgICAgICAgWy9ePDwoQGhlcmVkZWxpbSkuKi8sIHsgdG9rZW46ICdzdHJpbmcuaGVyZWRvYy5kZWxpbWl0ZXInLCBuZXh0OiAnQGhlcmVkb2MuJDEnIH1dLFxyXG4gICAgICAgICAgICAvLyB3aGl0ZXNwYWNlXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B3aGl0ZXNwYWNlJyB9LFxyXG4gICAgICAgICAgICAvLyBzdHJpbmdzXHJcbiAgICAgICAgICAgIFsvXCIvLCB7IHRva2VuOiAnc3RyaW5nLmQuZGVsaW0nLCBuZXh0OiAnQGRzdHJpbmcuZC5cIicgfV0sXHJcbiAgICAgICAgICAgIFsvJy8sIHsgdG9rZW46ICdzdHJpbmcuc3EuZGVsaW0nLCBuZXh0OiAnQHNzdHJpbmcuc3EnIH1dLFxyXG4gICAgICAgICAgICAvLyAlIGxpdGVyYWxzLiBGb3IgZWZmaWNpZW5jeSwgcmVtYXRjaCBpbiB0aGUgJ3BzdHJpbmcnIHN0YXRlXHJcbiAgICAgICAgICAgIFsvJShbcnNxeHdXXXxRPykvLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAncHN0cmluZycgfV0sXHJcbiAgICAgICAgICAgIC8vIGNvbW1hbmRzIGFuZCBzeW1ib2xzXHJcbiAgICAgICAgICAgIFsvYC8sIHsgdG9rZW46ICdzdHJpbmcueC5kZWxpbScsIG5leHQ6ICdAZHN0cmluZy54LmAnIH1dLFxyXG4gICAgICAgICAgICBbLzooXFx3fFskQF0pXFx3KlshPz1dPy8sICdzdHJpbmcucyddLFxyXG4gICAgICAgICAgICBbLzpcIi8sIHsgdG9rZW46ICdzdHJpbmcucy5kZWxpbScsIG5leHQ6ICdAZHN0cmluZy5zLlwiJyB9XSxcclxuICAgICAgICAgICAgWy86Jy8sIHsgdG9rZW46ICdzdHJpbmcucy5kZWxpbScsIG5leHQ6ICdAc3N0cmluZy5zJyB9XSxcclxuICAgICAgICAgICAgLy8gcmVndWxhciBleHByZXNzaW9ucy4gTG9va2FoZWFkIGZvciBhIChub3QgZXNjYXBlZCkgY2xvc2luZyBmb3J3YXJkc2xhc2ggb24gdGhlIHNhbWUgbGluZVxyXG4gICAgICAgICAgICBbL1xcLyg/PShcXFxcXFwvfFteXFwvXFxuXSkrXFwvKS8sIHsgdG9rZW46ICdyZWdleHAuZGVsaW0nLCBuZXh0OiAnQHJlZ2V4cCcgfV0sXHJcbiAgICAgICAgICAgIC8vIGRlbGltaXRlcnMgYW5kIG9wZXJhdG9yc1xyXG4gICAgICAgICAgICBbL1t7fSgpXFxbXFxdXS8sICdAYnJhY2tldHMnXSxcclxuICAgICAgICAgICAgWy9Ac3ltYm9scy8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRvcHMnOiAna2V5d29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAb3BlcmF0b3JzJzogJ29wZXJhdG9yJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJydcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgWy9bOyxdLywgJ2RlbGltaXRlciddLFxyXG4gICAgICAgICAgICAvLyBudW1iZXJzXHJcbiAgICAgICAgICAgIFsvMFt4WF1bMC05YS1mQS1GXShfP1swLTlhLWZBLUZdKSovLCAnbnVtYmVyLmhleCddLFxyXG4gICAgICAgICAgICBbLzBbX29PXVswLTddKF8/WzAtN10pKi8sICdudW1iZXIub2N0YWwnXSxcclxuICAgICAgICAgICAgWy8wW2JCXVswMV0oXz9bMDFdKSovLCAnbnVtYmVyLmJpbmFyeSddLFxyXG4gICAgICAgICAgICBbLzBbZERdQGRlY3BhcnQvLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIFsvQGRlY2ltYWwoKFxcLkBkZWNwYXJ0KT8oW2VFXVtcXC0rXT9AZGVjcGFydCk/KS8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJDEnOiAnbnVtYmVyLmZsb2F0JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ251bWJlcidcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIHVzZWQgdG8gbm90IHRyZWF0IGEgJ2RvJyBhcyBhIGJsb2NrIG9wZW5lciBpZiBpdCBvY2N1cnMgb24gdGhlIHNhbWVcclxuICAgICAgICAvLyBsaW5lIGFzIGEgJ2RvJyBzdGF0ZW1lbnQ6ICd3aGlsZXx1bnRpbHxmb3InXHJcbiAgICAgICAgLy8gZG9kZWNsLjxkZWNsPiB3aGVyZSBkZWNsIGlzIHRoZSBkZWNsYXJhdGlvbnMgc3RhcnRlZCwgbGlrZSAnd2hpbGUnXHJcbiAgICAgICAgZG9kZWNsOiBbXHJcbiAgICAgICAgICAgIFsvXi8sIHsgdG9rZW46ICcnLCBzd2l0Y2hUbzogJ0Byb290LiRTMicgfV0sXHJcbiAgICAgICAgICAgIFsvW2Etel9dXFx3KlshPz1dPy8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZW5kJzogeyB0b2tlbjogJ2tleXdvcmQuJFMyJywgbmV4dDogJ0Bwb3AnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkbyc6IHsgdG9rZW46ICdrZXl3b3JkJywgc3dpdGNoVG86ICdAcm9vdC4kUzInIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAbGluZWRlY2xzJzogeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAcm9vdC4kUzInIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHMnOiAna2V5d29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAYnVpbHRpbnMnOiAncHJlZGVmaW5lZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAcm9vdCcgfVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gdXNlZCB0byBwcmV2ZW50IHBvdGVudGlhbCBtb2RpZmllcnMgKCdpZnx1bnRpbHx3aGlsZXx1bmxlc3MnKSB0byBtYXRjaFxyXG4gICAgICAgIC8vIHdpdGggJ2VuZCcga2V5d29yZHMuXHJcbiAgICAgICAgLy8gbW9kaWZpZXIuPGRlY2w+eCB3aGVyZSBkZWNsIGlzIHRoZSBkZWNsYXJhdGlvbiBzdGFydGVyLCBsaWtlICdpZidcclxuICAgICAgICBtb2RpZmllcjogW1xyXG4gICAgICAgICAgICBbL14vLCAnJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9bYS16X11cXHcqWyE/PV0/Lywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdlbmQnOiB7IHRva2VuOiAna2V5d29yZC4kUzInLCBuZXh0OiAnQHBvcCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RoZW58ZWxzZXxlbHNpZnxkbyc6IHsgdG9rZW46ICdrZXl3b3JkJywgc3dpdGNoVG86ICdAcm9vdC4kUzInIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAbGluZWRlY2xzJzogeyB0b2tlbjogJ0ByZW1hdGNoJywgc3dpdGNoVG86ICdAcm9vdC4kUzInIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHMnOiAna2V5d29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAYnVpbHRpbnMnOiAncHJlZGVmaW5lZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAcm9vdCcgfVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gc2luZ2xlIHF1b3RlIHN0cmluZ3MgKGFsc28gdXNlZCBmb3Igc3ltYm9scylcclxuICAgICAgICAvLyBzc3RyaW5nLjxraW5kPiAgd2hlcmUga2luZCBpcyAnc3EnIChzaW5nbGUgcXVvdGUpIG9yICdzJyAoc3ltYm9sKVxyXG4gICAgICAgIHNzdHJpbmc6IFtcclxuICAgICAgICAgICAgWy9bXlxcXFwnXSsvLCAnc3RyaW5nLiRTMiddLFxyXG4gICAgICAgICAgICBbL1xcXFxcXFxcfFxcXFwnfFxcXFwkLywgJ3N0cmluZy4kUzIuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXC4vLCAnc3RyaW5nLiRTMi5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvJy8sIHsgdG9rZW46ICdzdHJpbmcuJFMyLmRlbGltJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBkb3VibGUgcXVvdGVkIFwic3RyaW5nXCIuXHJcbiAgICAgICAgLy8gZHN0cmluZy48a2luZD4uPGRlbGltPiB3aGVyZSBraW5kIGlzICdkJyAoZG91YmxlIHF1b3RlZCksICd4JyAoY29tbWFuZCksIG9yICdzJyAoc3ltYm9sKVxyXG4gICAgICAgIC8vIGFuZCBkZWxpbSBpcyB0aGUgZW5kaW5nIGRlbGltaXRlciAoXCIgb3IgYClcclxuICAgICAgICBkc3RyaW5nOiBbXHJcbiAgICAgICAgICAgIFsvW15cXFxcYFwiI10rLywgJ3N0cmluZy4kUzInXSxcclxuICAgICAgICAgICAgWy8jLywgJ3N0cmluZy4kUzIuZXNjYXBlJywgJ0BpbnRlcnBvbGF0ZWQnXSxcclxuICAgICAgICAgICAgWy9cXFxcJC8sICdzdHJpbmcuJFMyLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL0Blc2NhcGVzLywgJ3N0cmluZy4kUzIuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXC4vLCAnc3RyaW5nLiRTMi5lc2NhcGUuaW52YWxpZCddLFxyXG4gICAgICAgICAgICBbL1tgXCJdLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICckIz09JFMzJzogeyB0b2tlbjogJ3N0cmluZy4kUzIuZGVsaW0nLCBuZXh0OiAnQHBvcCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ3N0cmluZy4kUzInXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIGxpdGVyYWwgZG9jdW1lbnRzXHJcbiAgICAgICAgLy8gaGVyZWRvYy48Y2xvc2U+IHdoZXJlIGNsb3NlIGlzIHRoZSBjbG9zaW5nIGRlbGltaXRlclxyXG4gICAgICAgIGhlcmVkb2M6IFtcclxuICAgICAgICAgICAgWy9eKFxccyopKEBoZXJlZGVsaW0pJC8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJDI9PSRTMic6IFsnc3RyaW5nLmhlcmVkb2MnLCB7IHRva2VuOiAnc3RyaW5nLmhlcmVkb2MuZGVsaW1pdGVyJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiBbJ3N0cmluZy5oZXJlZG9jJywgJ3N0cmluZy5oZXJlZG9jJ11cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgWy8uKi8sICdzdHJpbmcuaGVyZWRvYyddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gaW50ZXJwb2xhdGVkIHNlcXVlbmNlXHJcbiAgICAgICAgaW50ZXJwb2xhdGVkOiBbXHJcbiAgICAgICAgICAgIFsvXFwkXFx3Ki8sICdnbG9iYWwuY29uc3RhbnQnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbL0BcXHcqLywgJ25hbWVzcGFjZS5jbGFzcy5pZGVudGlmaWVyJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9AQFxcdyovLCAnbmFtZXNwYWNlLmluc3RhbmNlLmlkZW50aWZpZXInLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbL1t7XS8sIHsgdG9rZW46ICdzdHJpbmcuZXNjYXBlLmN1cmx5Jywgc3dpdGNoVG86ICdAaW50ZXJwb2xhdGVkX2NvbXBvdW5kJyB9XSxcclxuICAgICAgICAgICAgWycnLCAnJywgJ0Bwb3AnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIGFueSBjb2RlXHJcbiAgICAgICAgaW50ZXJwb2xhdGVkX2NvbXBvdW5kOiBbXHJcbiAgICAgICAgICAgIFsvW31dLywgeyB0b2tlbjogJ3N0cmluZy5lc2NhcGUuY3VybHknLCBuZXh0OiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0Byb290JyB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gJXIgcXVvdGVkIHJlZ2V4cFxyXG4gICAgICAgIC8vIHByZWdleHAuPG9wZW4+LjxjbG9zZT4gd2hlcmUgb3Blbi9jbG9zZSBhcmUgdGhlIG9wZW4vY2xvc2UgZGVsaW1pdGVyXHJcbiAgICAgICAgcHJlZ2V4cDogW1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgLy8gdHVybnMgb3V0IHRoYXQgeW91IGNhbiBxdW90ZSB1c2luZyByZWdleCBjb250cm9sIGNoYXJhY3RlcnMsIGFhcmdoIVxyXG4gICAgICAgICAgICAvLyBmb3IgZXhhbXBsZTsgJXJ8a2dqZ2FqfCBpcyBvayAoZXZlbiB0aG91Z2ggfCBpcyB1c2VkIGZvciBhbHRlcm5hdGlvbilcclxuICAgICAgICAgICAgLy8gc28sIHdlIG5lZWQgdG8gbWF0Y2ggdGhvc2UgZmlyc3RcclxuICAgICAgICAgICAgWy9bXlxcKFxce1xcW1xcXFxdLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICckIz09JFMzJzogeyB0b2tlbjogJ3JlZ2V4cC5kZWxpbScsIG5leHQ6ICdAcG9wJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJCM9PSRTMic6IHsgdG9rZW46ICdyZWdleHAuZGVsaW0nLCBuZXh0OiAnQHB1c2gnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICd+Wyl9XFxcXF1dJzogJ0BicmFja2V0cy5yZWdleHAuZXNjYXBlLmNvbnRyb2wnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnfkByZWdleHBjdGwnOiAncmVnZXhwLmVzY2FwZS5jb250cm9sJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ3JlZ2V4cCdcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHJlZ2V4Y29udHJvbCcgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIFdlIG1hdGNoIHJlZ3VsYXIgZXhwcmVzc2lvbiBxdWl0ZSBwcmVjaXNlbHlcclxuICAgICAgICByZWdleHA6IFtcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHJlZ2V4Y29udHJvbCcgfSxcclxuICAgICAgICAgICAgWy9bXlxcXFxcXC9dLywgJ3JlZ2V4cCddLFxyXG4gICAgICAgICAgICBbJy9baXhtcF0qJywgeyB0b2tlbjogJ3JlZ2V4cC5kZWxpbScgfSwgJ0Bwb3AnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlZ2V4Y29udHJvbDogW1xyXG4gICAgICAgICAgICBbLyhcXHspKFxcZCsoPzosXFxkKik/KShcXH0pLywgWydAYnJhY2tldHMucmVnZXhwLmVzY2FwZS5jb250cm9sJywgJ3JlZ2V4cC5lc2NhcGUuY29udHJvbCcsICdAYnJhY2tldHMucmVnZXhwLmVzY2FwZS5jb250cm9sJ11dLFxyXG4gICAgICAgICAgICBbLyhcXFspKFxcXj8pLywgWydAYnJhY2tldHMucmVnZXhwLmVzY2FwZS5jb250cm9sJywgeyB0b2tlbjogJ3JlZ2V4cC5lc2NhcGUuY29udHJvbCcsIG5leHQ6ICdAcmVnZXhyYW5nZScgfV1dLFxyXG4gICAgICAgICAgICBbLyhcXCgpKFxcP1s6PSFdKS8sIFsnQGJyYWNrZXRzLnJlZ2V4cC5lc2NhcGUuY29udHJvbCcsICdyZWdleHAuZXNjYXBlLmNvbnRyb2wnXV0sXHJcbiAgICAgICAgICAgIFsvXFwoXFw/Iy8sIHsgdG9rZW46ICdyZWdleHAuZXNjYXBlLmNvbnRyb2wnLCBuZXh0OiAnQHJlZ2V4cGNvbW1lbnQnIH1dLFxyXG4gICAgICAgICAgICBbL1soKV0vLCAnQGJyYWNrZXRzLnJlZ2V4cC5lc2NhcGUuY29udHJvbCddLFxyXG4gICAgICAgICAgICBbL0ByZWdleHBjdGwvLCAncmVnZXhwLmVzY2FwZS5jb250cm9sJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXCQvLCAncmVnZXhwLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL0ByZWdleHBlc2MvLCAncmVnZXhwLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL1xcXFxcXC4vLCAncmVnZXhwLmludmFsaWQnXSxcclxuICAgICAgICAgICAgWy8jLywgJ3JlZ2V4cC5lc2NhcGUnLCAnQGludGVycG9sYXRlZCddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVnZXhyYW5nZTogW1xyXG4gICAgICAgICAgICBbLy0vLCAncmVnZXhwLmVzY2FwZS5jb250cm9sJ10sXHJcbiAgICAgICAgICAgIFsvXFxeLywgJ3JlZ2V4cC5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXCQvLCAncmVnZXhwLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL0ByZWdleHBlc2MvLCAncmVnZXhwLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL1teXFxdXS8sICdyZWdleHAnXSxcclxuICAgICAgICAgICAgWy9cXF0vLCAnQGJyYWNrZXRzLnJlZ2V4cC5lc2NhcGUuY29udHJvbCcsICdAcG9wJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZWdleHBjb21tZW50OiBbXHJcbiAgICAgICAgICAgIFsvW14pXSsvLCAnY29tbWVudCddLFxyXG4gICAgICAgICAgICBbL1xcKS8sIHsgdG9rZW46ICdyZWdleHAuZXNjYXBlLmNvbnRyb2wnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vICUgcXVvdGVkIHN0cmluZ3NcclxuICAgICAgICAvLyBBIGJpdCByZXBldGl0aXZlIHNpbmNlIHdlIG5lZWQgdG8gb2Z0ZW4gc3BlY2lhbCBjYXNlIHRoZSBraW5kIG9mIGVuZGluZyBkZWxpbWl0ZXJcclxuICAgICAgICBwc3RyaW5nOiBbXHJcbiAgICAgICAgICAgIFsvJShbcXdzXSlcXCgvLCB7IHRva2VuOiAnc3RyaW5nLiQxLmRlbGltJywgc3dpdGNoVG86ICdAcXN0cmluZy4kMS4oLiknIH1dLFxyXG4gICAgICAgICAgICBbLyUoW3F3c10pXFxbLywgeyB0b2tlbjogJ3N0cmluZy4kMS5kZWxpbScsIHN3aXRjaFRvOiAnQHFzdHJpbmcuJDEuWy5dJyB9XSxcclxuICAgICAgICAgICAgWy8lKFtxd3NdKVxcey8sIHsgdG9rZW46ICdzdHJpbmcuJDEuZGVsaW0nLCBzd2l0Y2hUbzogJ0Bxc3RyaW5nLiQxLnsufScgfV0sXHJcbiAgICAgICAgICAgIFsvJShbcXdzXSk8LywgeyB0b2tlbjogJ3N0cmluZy4kMS5kZWxpbScsIHN3aXRjaFRvOiAnQHFzdHJpbmcuJDEuPC4+JyB9XSxcclxuICAgICAgICAgICAgWy8lKFtxd3NdKShAZGVsaW0pLywgeyB0b2tlbjogJ3N0cmluZy4kMS5kZWxpbScsIHN3aXRjaFRvOiAnQHFzdHJpbmcuJDEuJDIuJDInIH1dLFxyXG4gICAgICAgICAgICBbLyVyXFwoLywgeyB0b2tlbjogJ3JlZ2V4cC5kZWxpbScsIHN3aXRjaFRvOiAnQHByZWdleHAuKC4pJyB9XSxcclxuICAgICAgICAgICAgWy8lclxcWy8sIHsgdG9rZW46ICdyZWdleHAuZGVsaW0nLCBzd2l0Y2hUbzogJ0BwcmVnZXhwLlsuXScgfV0sXHJcbiAgICAgICAgICAgIFsvJXJcXHsvLCB7IHRva2VuOiAncmVnZXhwLmRlbGltJywgc3dpdGNoVG86ICdAcHJlZ2V4cC57Ln0nIH1dLFxyXG4gICAgICAgICAgICBbLyVyPC8sIHsgdG9rZW46ICdyZWdleHAuZGVsaW0nLCBzd2l0Y2hUbzogJ0BwcmVnZXhwLjwuPicgfV0sXHJcbiAgICAgICAgICAgIFsvJXIoQGRlbGltKS8sIHsgdG9rZW46ICdyZWdleHAuZGVsaW0nLCBzd2l0Y2hUbzogJ0BwcmVnZXhwLiQxLiQxJyB9XSxcclxuICAgICAgICAgICAgWy8lKHh8V3xRPylcXCgvLCB7IHRva2VuOiAnc3RyaW5nLiQxLmRlbGltJywgc3dpdGNoVG86ICdAcXFzdHJpbmcuJDEuKC4pJyB9XSxcclxuICAgICAgICAgICAgWy8lKHh8V3xRPylcXFsvLCB7IHRva2VuOiAnc3RyaW5nLiQxLmRlbGltJywgc3dpdGNoVG86ICdAcXFzdHJpbmcuJDEuWy5dJyB9XSxcclxuICAgICAgICAgICAgWy8lKHh8V3xRPylcXHsvLCB7IHRva2VuOiAnc3RyaW5nLiQxLmRlbGltJywgc3dpdGNoVG86ICdAcXFzdHJpbmcuJDEuey59JyB9XSxcclxuICAgICAgICAgICAgWy8lKHh8V3xRPyk8LywgeyB0b2tlbjogJ3N0cmluZy4kMS5kZWxpbScsIHN3aXRjaFRvOiAnQHFxc3RyaW5nLiQxLjwuPicgfV0sXHJcbiAgICAgICAgICAgIFsvJSh4fFd8UT8pKEBkZWxpbSkvLCB7IHRva2VuOiAnc3RyaW5nLiQxLmRlbGltJywgc3dpdGNoVG86ICdAcXFzdHJpbmcuJDEuJDIuJDInIH1dLFxyXG4gICAgICAgICAgICBbLyUoW3Jxd3N4V118UT8pLi8sIHsgdG9rZW46ICdpbnZhbGlkJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbLy4vLCB7IHRva2VuOiAnaW52YWxpZCcsIG5leHQ6ICdAcG9wJyB9XSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIG5vbi1leHBhbmRlZCBxdW90ZWQgc3RyaW5nLlxyXG4gICAgICAgIC8vIHFzdHJpbmcuPGtpbmQ+LjxvcGVuPi48Y2xvc2U+XHJcbiAgICAgICAgLy8gIGtpbmQgPSBxfHd8cyAgKHNpbmdsZSBxdW90ZSwgYXJyYXksIHN5bWJvbClcclxuICAgICAgICAvLyAgb3BlbiA9IG9wZW4gZGVsaW1pdGVyXHJcbiAgICAgICAgLy8gIGNsb3NlID0gY2xvc2UgZGVsaW1pdGVyXHJcbiAgICAgICAgcXN0cmluZzogW1xyXG4gICAgICAgICAgICBbL1xcXFwkLywgJ3N0cmluZy4kUzIuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXC4vLCAnc3RyaW5nLiRTMi5lc2NhcGUnXSxcclxuICAgICAgICAgICAgWy8uLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICckIz09JFM0JzogeyB0b2tlbjogJ3N0cmluZy4kUzIuZGVsaW0nLCBuZXh0OiAnQHBvcCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJyQjPT0kUzMnOiB7IHRva2VuOiAnc3RyaW5nLiRTMi5kZWxpbScsIG5leHQ6ICdAcHVzaCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ3N0cmluZy4kUzInXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBleHBhbmRlZCBxdW90ZWQgc3RyaW5nLlxyXG4gICAgICAgIC8vIHFxc3RyaW5nLjxraW5kPi48b3Blbj4uPGNsb3NlPlxyXG4gICAgICAgIC8vICBraW5kID0gUXxXfHggIChkb3VibGUgcXVvdGUsIGFycmF5LCBjb21tYW5kKVxyXG4gICAgICAgIC8vICBvcGVuID0gb3BlbiBkZWxpbWl0ZXJcclxuICAgICAgICAvLyAgY2xvc2UgPSBjbG9zZSBkZWxpbWl0ZXJcclxuICAgICAgICBxcXN0cmluZzogW1xyXG4gICAgICAgICAgICBbLyMvLCAnc3RyaW5nLiRTMi5lc2NhcGUnLCAnQGludGVycG9sYXRlZCddLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAcXN0cmluZycgfVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gd2hpdGVzcGFjZSAmIGNvbW1lbnRzXHJcbiAgICAgICAgd2hpdGVzcGFjZTogW1xyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvLCAnJ10sXHJcbiAgICAgICAgICAgIFsvXlxccyo9YmVnaW5cXGIvLCAnY29tbWVudCcsICdAY29tbWVudCddLFxyXG4gICAgICAgICAgICBbLyMuKiQvLCAnY29tbWVudCddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29tbWVudDogW1xyXG4gICAgICAgICAgICBbL1tePV0rLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICAgICAgWy9eXFxzKj1iZWdpblxcYi8sICdjb21tZW50LmludmFsaWQnXSxcclxuICAgICAgICAgICAgWy9eXFxzKj1lbmRcXGIuKi8sICdjb21tZW50JywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9bPV0vLCAnY29tbWVudCddXHJcbiAgICAgICAgXSxcclxuICAgIH1cclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIifQ==