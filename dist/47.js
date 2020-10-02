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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3J1YnkvcnVieS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxXQUFXLEtBQUs7QUFDaEI7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ0EsME5BQTBOO0FBQzFOLG1EQUFtRDtBQUNuRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsd0RBQXdE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LHVCQUF1Qix5REFBeUQ7QUFDaEY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFvQiwrQ0FBK0M7QUFDbkU7QUFDQTtBQUNBO0FBQ0E7QUFDQSw0QkFBNEIsd0RBQXdEO0FBQ3BGLDRCQUE0Qix3REFBd0Q7QUFDcEYsd0JBQXdCLElBQUksbURBQW1ELEVBQUUsR0FBRztBQUNwRiwyQkFBMkIsd0RBQXdEO0FBQ25GLGtDQUFrQywwREFBMEQ7QUFDNUYsc0JBQXNCLGtEQUFrRDtBQUN4RSxzQkFBc0Isa0RBQWtEO0FBQ3hFLGtCQUFrQixJQUFJLDZDQUE2QyxFQUFFLEdBQUc7QUFDeEUscUJBQXFCLGtEQUFrRDtBQUN2RSw0QkFBNEIsb0RBQW9EO0FBQ2hGLDZCQUE2Qix5REFBeUQ7QUFDdEYsNkJBQTZCLHlEQUF5RDtBQUN0Rix5QkFBeUIsSUFBSSxvREFBb0QsRUFBRSxHQUFHO0FBQ3RGLDRCQUE0Qix5REFBeUQ7QUFDckYsbUNBQW1DLDJEQUEyRDtBQUM5RixpQ0FBaUMsaUNBQWlDO0FBQ2xFLG1CQUFtQixpQ0FBaUM7QUFDcEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9DQUFvQywwQ0FBMEM7QUFDOUUsb0NBQW9DLDJDQUEyQztBQUMvRTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IjQ3LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBsaW5lQ29tbWVudDogJyMnLFxyXG4gICAgICAgIGJsb2NrQ29tbWVudDogWyc9YmVnaW4nLCAnPWVuZCddLFxyXG4gICAgfSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgWycoJywgJyknXSxcclxuICAgICAgICBbJ3snLCAnfSddLFxyXG4gICAgICAgIFsnWycsICddJ11cclxuICAgIF0sXHJcbiAgICBhdXRvQ2xvc2luZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXCInLCBjbG9zZTogJ1wiJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJyB9LFxyXG4gICAgXSxcclxuICAgIHN1cnJvdW5kaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICBdLFxyXG4gICAgaW5kZW50YXRpb25SdWxlczoge1xyXG4gICAgICAgIGluY3JlYXNlSW5kZW50UGF0dGVybjogbmV3IFJlZ0V4cCgnXlxcXFxzKigoYmVnaW58Y2xhc3N8KHByaXZhdGV8cHJvdGVjdGVkKVxcXFxzK2RlZnxkZWZ8ZWxzZXxlbHNpZnxlbnN1cmV8Zm9yfGlmfG1vZHVsZXxyZXNjdWV8dW5sZXNzfHVudGlsfHdoZW58d2hpbGV8Y2FzZSl8KFteI10qXFxcXHNkb1xcXFxiKXwoW14jXSo9XFxcXHMqKGNhc2V8aWZ8dW5sZXNzKSkpXFxcXGIoW14jXFxcXHs7XXwoXCJ8XFwnfFxcLykuKlxcXFw0KSooIy4qKT8kJyksXHJcbiAgICAgICAgZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiBuZXcgUmVnRXhwKCdeXFxcXHMqKFt9XFxcXF1dKFssKV0/XFxcXHMqKCN8JCl8XFxcXC5bYS16QS1aX11cXFxcdypcXFxcYil8KGVuZHxyZXNjdWV8ZW5zdXJlfGVsc2V8ZWxzaWZ8d2hlbilcXFxcYiknKSxcclxuICAgIH1cclxufTtcclxuLypcclxuICogUnVieSBsYW5ndWFnZSBkZWZpbml0aW9uXHJcbiAqXHJcbiAqIFF1aXRlIGEgY29tcGxleCBsYW5ndWFnZSBkdWUgdG8gZWxhYm9yYXRlIGVzY2FwZSBzZXF1ZW5jZXNcclxuICogYW5kIHF1b3Rpbmcgb2YgbGl0ZXJhdGUgc3RyaW5ncy9yZWd1bGFyIGV4cHJlc3Npb25zLCBhbmRcclxuICogYW4gJ2VuZCcga2V5d29yZCB0aGF0IGRvZXMgbm90IGFsd2F5cyBhcHBseSB0byBtb2RpZmllcnMgbGlrZSB1bnRpbCBhbmQgd2hpbGUsXHJcbiAqIGFuZCBhICdkbycga2V5d29yZCB0aGF0IHNvbWV0aW1lcyBzdGFydHMgYSBibG9jaywgYnV0IHNvbWV0aW1lcyBpcyBwYXJ0IG9mXHJcbiAqIGFub3RoZXIgc3RhdGVtZW50IChsaWtlICd3aGlsZScpLlxyXG4gKlxyXG4gKiAoMSkgZW5kIGJsb2NrczpcclxuICogJ2VuZCcgbWF5IGVuZCBkZWNsYXJhdGlvbnMgbGlrZSBpZiBvciB1bnRpbCwgYnV0IHNvbWV0aW1lcyAnaWYnIG9yICd1bnRpbCdcclxuICogYXJlIG1vZGlmaWVycyB3aGVyZSB0aGVyZSBpcyBubyAnZW5kJy4gQWxzbywgJ2RvJyBzb21ldGltZXMgc3RhcnRzIGEgYmxvY2tcclxuICogdGhhdCBpcyBlbmRlZCBieSAnZW5kJywgYnV0IHNvbWV0aW1lcyBpdCBpcyBwYXJ0IG9mIGEgJ3doaWxlJywgJ2ZvcicsIG9yICd1bnRpbCdcclxuICogVG8gZG8gcHJvcGVyIGJyYWNlIG1hdGNoaW5nIHdlIGRvIHNvbWUgZWxhYm9yYXRlIHN0YXRlIG1hbmlwdWxhdGlvbi5cclxuICogc29tZSBleGFtcGxlczpcclxuICpcclxuICogICB1bnRpbCBibGEgZG9cclxuICogICAgIHdvcmsgdW50aWwgdGlyZWRcclxuICogICAgIGxpc3QuZWFjaCBkb1xyXG4gKiAgICAgICBzb21ldGhpbmcgaWYgdGVzdFxyXG4gKiAgICAgZW5kXHJcbiAqICAgZW5kXHJcbiAqXHJcbiAqIG9yXHJcbiAqXHJcbiAqIGlmIHRlc3RcclxuICogIHNvbWV0aGluZyAoaWYgdGVzdCB0aGVuIHggZW5kKVxyXG4gKiAgYmFyIGlmIGJsYVxyXG4gKiBlbmRcclxuICpcclxuICogb3IsIGhvdyBhYm91dCB1c2luZyBjbGFzcyBhcyBhIHByb3BlcnR5Li5cclxuICpcclxuICogY2xhc3MgVGVzdFxyXG4gKiAgIGRlZiBlbmRwb2ludFxyXG4gKiAgICAgc2VsZi5jbGFzcy5lbmRwb2ludCB8fCByb3V0ZXNcclxuICogICBlbmRcclxuICogZW5kXHJcbiAqXHJcbiAqICgyKSBxdW90aW5nOlxyXG4gKiB0aGVyZSBhcmUgbWFueSBraW5kcyBvZiBzdHJpbmdzIGFuZCBlc2NhcGUgc2VxdWVuY2VzLiBCdXQgYWxzbywgb25lIGNhblxyXG4gKiBzdGFydCBtYW55IHN0cmluZy1saWtlIHRoaW5ncyBhcyAnJXF4JyB3aGVyZSBxIHNwZWNpZmllcyB0aGUga2luZCBvZiBzdHJpbmdcclxuICogKGxpa2UgYSBjb21tYW5kLCBlc2NhcGUgZXhwYW5kZWQsIHJlZ3VsYXIgZXhwcmVzc2lvbiwgc3ltYm9sIGV0Yy4pLCBhbmQgeCBpc1xyXG4gKiBzb21lIGNoYXJhY3RlciBhbmQgb25seSBhbm90aGVyICd4JyBlbmRzIHRoZSBzZXF1ZW5jZS4gRXhjZXB0IGZvciBicmFja2V0c1xyXG4gKiB3aGVyZSB0aGUgY2xvc2luZyBicmFja2V0IGVuZHMgdGhlIHNlcXVlbmNlLi4gYW5kIGV4Y2VwdCBmb3IgYSBuZXN0ZWQgYnJhY2tldFxyXG4gKiBpbnNpZGUgdGhlIHN0cmluZyBsaWtlIGVudGl0eS4gQWxzbywgc3VjaCBzdHJpbmdzIGNhbiBjb250YWluIGludGVycG9sYXRlZFxyXG4gKiBydWJ5IGV4cHJlc3Npb25zIGFnYWluIChhbmQgc3BhbiBtdWx0aXBsZSBsaW5lcykuIE1vcmVvdmVyLCBleHBhbmRlZFxyXG4gKiByZWd1bGFyIGV4cHJlc3Npb24gY2FuIGFsc28gY29udGFpbiBjb21tZW50cy5cclxuICovXHJcbmV4cG9ydCB2YXIgbGFuZ3VhZ2UgPSB7XHJcbiAgICB0b2tlblBvc3RmaXg6ICcucnVieScsXHJcbiAgICBrZXl3b3JkczogW1xyXG4gICAgICAgICdfX0xJTkVfXycsICdfX0VOQ09ESU5HX18nLCAnX19GSUxFX18nLCAnQkVHSU4nLCAnRU5EJywgJ2FsaWFzJywgJ2FuZCcsICdiZWdpbicsXHJcbiAgICAgICAgJ2JyZWFrJywgJ2Nhc2UnLCAnY2xhc3MnLCAnZGVmJywgJ2RlZmluZWQ/JywgJ2RvJywgJ2Vsc2UnLCAnZWxzaWYnLCAnZW5kJyxcclxuICAgICAgICAnZW5zdXJlJywgJ2ZvcicsICdmYWxzZScsICdpZicsICdpbicsICdtb2R1bGUnLCAnbmV4dCcsICduaWwnLCAnbm90JywgJ29yJywgJ3JlZG8nLFxyXG4gICAgICAgICdyZXNjdWUnLCAncmV0cnknLCAncmV0dXJuJywgJ3NlbGYnLCAnc3VwZXInLCAndGhlbicsICd0cnVlJywgJ3VuZGVmJywgJ3VubGVzcycsXHJcbiAgICAgICAgJ3VudGlsJywgJ3doZW4nLCAnd2hpbGUnLCAneWllbGQnLFxyXG4gICAgXSxcclxuICAgIGtleXdvcmRvcHM6IFtcclxuICAgICAgICAnOjonLCAnLi4nLCAnLi4uJywgJz8nLCAnOicsICc9PidcclxuICAgIF0sXHJcbiAgICBidWlsdGluczogW1xyXG4gICAgICAgICdyZXF1aXJlJywgJ3B1YmxpYycsICdwcml2YXRlJywgJ2luY2x1ZGUnLCAnZXh0ZW5kJywgJ2F0dHJfcmVhZGVyJyxcclxuICAgICAgICAncHJvdGVjdGVkJywgJ3ByaXZhdGVfY2xhc3NfbWV0aG9kJywgJ3Byb3RlY3RlZF9jbGFzc19tZXRob2QnLCAnbmV3J1xyXG4gICAgXSxcclxuICAgIC8vIHRoZXNlIGFyZSBjbG9zZWQgYnkgJ2VuZCcgKGlmLCB3aGlsZSBhbmQgdW50aWwgYXJlIGhhbmRsZWQgc2VwYXJhdGVseSlcclxuICAgIGRlY2xhcmF0aW9uczogW1xyXG4gICAgICAgICdtb2R1bGUnLCAnY2xhc3MnLCAnZGVmJywgJ2Nhc2UnLCAnZG8nLCAnYmVnaW4nLCAnZm9yJywgJ2lmJywgJ3doaWxlJywgJ3VudGlsJywgJ3VubGVzcydcclxuICAgIF0sXHJcbiAgICBsaW5lZGVjbHM6IFtcclxuICAgICAgICAnZGVmJywgJ2Nhc2UnLCAnZG8nLCAnYmVnaW4nLCAnZm9yJywgJ2lmJywgJ3doaWxlJywgJ3VudGlsJywgJ3VubGVzcydcclxuICAgIF0sXHJcbiAgICBvcGVyYXRvcnM6IFtcclxuICAgICAgICAnXicsICcmJywgJ3wnLCAnPD0+JywgJz09JywgJz09PScsICchficsICc9ficsICc+JywgJz49JywgJzwnLCAnPD0nLCAnPDwnLCAnPj4nLCAnKycsXHJcbiAgICAgICAgJy0nLCAnKicsICcvJywgJyUnLCAnKionLCAnficsICcrQCcsICctQCcsICdbXScsICdbXT0nLCAnYCcsXHJcbiAgICAgICAgJys9JywgJy09JywgJyo9JywgJyoqPScsICcvPScsICdePScsICclPScsICc8PD0nLCAnPj49JywgJyY9JywgJyYmPScsICd8fD0nLCAnfD0nXHJcbiAgICBdLFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJywgdG9rZW46ICdkZWxpbWl0ZXIucGFyZW50aGVzaXMnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScsIHRva2VuOiAnZGVsaW1pdGVyLmN1cmx5JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nLCB0b2tlbjogJ2RlbGltaXRlci5zcXVhcmUnIH1cclxuICAgIF0sXHJcbiAgICAvLyB3ZSBpbmNsdWRlIHRoZXNlIGNvbW1vbiByZWd1bGFyIGV4cHJlc3Npb25zXHJcbiAgICBzeW1ib2xzOiAvWz0+PCF+PzomfCtcXC0qXFwvXFxeJVxcLl0rLyxcclxuICAgIC8vIGVzY2FwZSBzZXF1ZW5jZXNcclxuICAgIGVzY2FwZTogLyg/OlthYmVmbnJzdHZcXFxcXCInXFxuXFxyXXxbMC03XXsxLDN9fHhbMC05QS1GYS1mXXsxLDJ9fHVbMC05QS1GYS1mXXs0fSkvLFxyXG4gICAgZXNjYXBlczogL1xcXFwoPzpDXFwtKEBlc2NhcGV8Lil8YyhAZXNjYXBlfC4pfEBlc2NhcGUpLyxcclxuICAgIGRlY3BhcnQ6IC9cXGQoXz9cXGQpKi8sXHJcbiAgICBkZWNpbWFsOiAvMHxAZGVjcGFydC8sXHJcbiAgICBkZWxpbTogL1teYS16QS1aMC05XFxzXFxuXFxyXS8sXHJcbiAgICBoZXJlZGVsaW06IC8oPzpcXHcrfCdbXiddKid8XCJbXlwiXSpcInxgW15gXSpgKS8sXHJcbiAgICByZWdleHBjdGw6IC9bKCl7fVxcW1xcXVxcJFxcXnxcXC0qKz9cXC5dLyxcclxuICAgIHJlZ2V4cGVzYzogL1xcXFwoPzpbQXpaYkJkRGZucnN0dndXbjBcXFxcXFwvXXxAcmVnZXhwY3RsfGNbQS1aXXx4WzAtOWEtZkEtRl17Mn18dVswLTlhLWZBLUZdezR9KT8vLFxyXG4gICAgLy8gVGhlIG1haW4gdG9rZW5pemVyIGZvciBvdXIgbGFuZ3VhZ2VzXHJcbiAgICB0b2tlbml6ZXI6IHtcclxuICAgICAgICAvLyBNYWluIGVudHJ5LlxyXG4gICAgICAgIC8vIHJvb3QuPGRlY2w+IHdoZXJlIGRlY2wgaXMgdGhlIGN1cnJlbnQgb3BlbmluZyBkZWNsYXJhdGlvbiAobGlrZSAnY2xhc3MnKVxyXG4gICAgICAgIHJvb3Q6IFtcclxuICAgICAgICAgICAgLy8gaWRlbnRpZmllcnMgYW5kIGtleXdvcmRzXHJcbiAgICAgICAgICAgIC8vIG1vc3QgY29tcGxleGl0eSBoZXJlIGlzIGR1ZSB0byBtYXRjaGluZyAnZW5kJyBjb3JyZWN0bHkgd2l0aCBkZWNsYXJhdGlvbnMuXHJcbiAgICAgICAgICAgIC8vIFdlIGRpc3Rpbmd1aXNoIGEgZGVjbGFyYXRpb24gdGhhdCBjb21lcyBmaXJzdCBvbiBhIGxpbmUsIHZlcnN1cyBkZWNsYXJhdGlvbnMgZnVydGhlciBvbiBhIGxpbmUgKHdoaWNoIGFyZSBtb3N0IGxpa2V5IG1vZGlmaWVycylcclxuICAgICAgICAgICAgWy9eKFxccyopKFthLXpfXVxcdypbIT89XT8pLywgWyd3aGl0ZScsXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2Zvcnx1bnRpbHx3aGlsZSc6IHsgdG9rZW46ICdrZXl3b3JkLiQyJywgbmV4dDogJ0Bkb2RlY2wuJDInIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnQGRlY2xhcmF0aW9ucyc6IHsgdG9rZW46ICdrZXl3b3JkLiQyJywgbmV4dDogJ0Byb290LiQyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2VuZCc6IHsgdG9rZW46ICdrZXl3b3JkLiRTMicsIG5leHQ6ICdAcG9wJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdAYnVpbHRpbnMnOiAncHJlZGVmaW5lZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnaWRlbnRpZmllcidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1dXSxcclxuICAgICAgICAgICAgWy9bYS16X11cXHcqWyE/PV0/LyxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnaWZ8dW5sZXNzfHdoaWxlfHVudGlsJzogeyB0b2tlbjogJ2tleXdvcmQuJDB4JywgbmV4dDogJ0Btb2RpZmllci4kMHgnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdmb3InOiB7IHRva2VuOiAna2V5d29yZC4kMicsIG5leHQ6ICdAZG9kZWNsLiQyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGxpbmVkZWNscyc6IHsgdG9rZW46ICdrZXl3b3JkLiQwJywgbmV4dDogJ0Byb290LiQwJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZW5kJzogeyB0b2tlbjogJ2tleXdvcmQuJFMyJywgbmV4dDogJ0Bwb3AnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHMnOiAna2V5d29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAYnVpbHRpbnMnOiAncHJlZGVmaW5lZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgICAgICBbL1tBLVpdW1xcd10qWyE/PV0/LywgJ2NvbnN0cnVjdG9yLmlkZW50aWZpZXInXSxcclxuICAgICAgICAgICAgWy9cXCRbXFx3XSovLCAnZ2xvYmFsLmNvbnN0YW50J10sXHJcbiAgICAgICAgICAgIFsvQFtcXHddKi8sICduYW1lc3BhY2UuaW5zdGFuY2UuaWRlbnRpZmllciddLFxyXG4gICAgICAgICAgICBbL0BAW1xcd10qLywgJ25hbWVzcGFjZS5jbGFzcy5pZGVudGlmaWVyJ10sXHJcbiAgICAgICAgICAgIC8vIGhlcmUgZG9jdW1lbnRcclxuICAgICAgICAgICAgWy88PFstfl0oQGhlcmVkZWxpbSkuKi8sIHsgdG9rZW46ICdzdHJpbmcuaGVyZWRvYy5kZWxpbWl0ZXInLCBuZXh0OiAnQGhlcmVkb2MuJDEnIH1dLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSs8PChAaGVyZWRlbGltKS4qLywgeyB0b2tlbjogJ3N0cmluZy5oZXJlZG9jLmRlbGltaXRlcicsIG5leHQ6ICdAaGVyZWRvYy4kMScgfV0sXHJcbiAgICAgICAgICAgIFsvXjw8KEBoZXJlZGVsaW0pLiovLCB7IHRva2VuOiAnc3RyaW5nLmhlcmVkb2MuZGVsaW1pdGVyJywgbmV4dDogJ0BoZXJlZG9jLiQxJyB9XSxcclxuICAgICAgICAgICAgLy8gd2hpdGVzcGFjZVxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgLy8gc3RyaW5nc1xyXG4gICAgICAgICAgICBbL1wiLywgeyB0b2tlbjogJ3N0cmluZy5kLmRlbGltJywgbmV4dDogJ0Bkc3RyaW5nLmQuXCInIH1dLFxyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nLnNxLmRlbGltJywgbmV4dDogJ0Bzc3RyaW5nLnNxJyB9XSxcclxuICAgICAgICAgICAgLy8gJSBsaXRlcmFscy4gRm9yIGVmZmljaWVuY3ksIHJlbWF0Y2ggaW4gdGhlICdwc3RyaW5nJyBzdGF0ZVxyXG4gICAgICAgICAgICBbLyUoW3JzcXh3V118UT8pLywgeyB0b2tlbjogJ0ByZW1hdGNoJywgbmV4dDogJ3BzdHJpbmcnIH1dLFxyXG4gICAgICAgICAgICAvLyBjb21tYW5kcyBhbmQgc3ltYm9sc1xyXG4gICAgICAgICAgICBbL2AvLCB7IHRva2VuOiAnc3RyaW5nLnguZGVsaW0nLCBuZXh0OiAnQGRzdHJpbmcueC5gJyB9XSxcclxuICAgICAgICAgICAgWy86KFxcd3xbJEBdKVxcdypbIT89XT8vLCAnc3RyaW5nLnMnXSxcclxuICAgICAgICAgICAgWy86XCIvLCB7IHRva2VuOiAnc3RyaW5nLnMuZGVsaW0nLCBuZXh0OiAnQGRzdHJpbmcucy5cIicgfV0sXHJcbiAgICAgICAgICAgIFsvOicvLCB7IHRva2VuOiAnc3RyaW5nLnMuZGVsaW0nLCBuZXh0OiAnQHNzdHJpbmcucycgfV0sXHJcbiAgICAgICAgICAgIC8vIHJlZ3VsYXIgZXhwcmVzc2lvbnMuIExvb2thaGVhZCBmb3IgYSAobm90IGVzY2FwZWQpIGNsb3NpbmcgZm9yd2FyZHNsYXNoIG9uIHRoZSBzYW1lIGxpbmVcclxuICAgICAgICAgICAgWy9cXC8oPz0oXFxcXFxcL3xbXlxcL1xcbl0pK1xcLykvLCB7IHRva2VuOiAncmVnZXhwLmRlbGltJywgbmV4dDogJ0ByZWdleHAnIH1dLFxyXG4gICAgICAgICAgICAvLyBkZWxpbWl0ZXJzIGFuZCBvcGVyYXRvcnNcclxuICAgICAgICAgICAgWy9be30oKVxcW1xcXV0vLCAnQGJyYWNrZXRzJ10sXHJcbiAgICAgICAgICAgIFsvQHN5bWJvbHMvLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkb3BzJzogJ2tleXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQG9wZXJhdG9ycyc6ICdvcGVyYXRvcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICcnXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgIFsvWzssXS8sICdkZWxpbWl0ZXInXSxcclxuICAgICAgICAgICAgLy8gbnVtYmVyc1xyXG4gICAgICAgICAgICBbLzBbeFhdWzAtOWEtZkEtRl0oXz9bMC05YS1mQS1GXSkqLywgJ251bWJlci5oZXgnXSxcclxuICAgICAgICAgICAgWy8wW19vT11bMC03XShfP1swLTddKSovLCAnbnVtYmVyLm9jdGFsJ10sXHJcbiAgICAgICAgICAgIFsvMFtiQl1bMDFdKF8/WzAxXSkqLywgJ251bWJlci5iaW5hcnknXSxcclxuICAgICAgICAgICAgWy8wW2REXUBkZWNwYXJ0LywgJ251bWJlciddLFxyXG4gICAgICAgICAgICBbL0BkZWNpbWFsKChcXC5AZGVjcGFydCk/KFtlRV1bXFwtK10/QGRlY3BhcnQpPykvLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJyQxJzogJ251bWJlci5mbG9hdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdudW1iZXInXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyB1c2VkIHRvIG5vdCB0cmVhdCBhICdkbycgYXMgYSBibG9jayBvcGVuZXIgaWYgaXQgb2NjdXJzIG9uIHRoZSBzYW1lXHJcbiAgICAgICAgLy8gbGluZSBhcyBhICdkbycgc3RhdGVtZW50OiAnd2hpbGV8dW50aWx8Zm9yJ1xyXG4gICAgICAgIC8vIGRvZGVjbC48ZGVjbD4gd2hlcmUgZGVjbCBpcyB0aGUgZGVjbGFyYXRpb25zIHN0YXJ0ZWQsIGxpa2UgJ3doaWxlJ1xyXG4gICAgICAgIGRvZGVjbDogW1xyXG4gICAgICAgICAgICBbL14vLCB7IHRva2VuOiAnJywgc3dpdGNoVG86ICdAcm9vdC4kUzInIH1dLFxyXG4gICAgICAgICAgICBbL1thLXpfXVxcdypbIT89XT8vLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2VuZCc6IHsgdG9rZW46ICdrZXl3b3JkLiRTMicsIG5leHQ6ICdAcG9wJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZG8nOiB7IHRva2VuOiAna2V5d29yZCcsIHN3aXRjaFRvOiAnQHJvb3QuJFMyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGxpbmVkZWNscyc6IHsgdG9rZW46ICdAcmVtYXRjaCcsIHN3aXRjaFRvOiAnQHJvb3QuJFMyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogJ2tleXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGJ1aWx0aW5zJzogJ3ByZWRlZmluZWQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnaWRlbnRpZmllcidcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHJvb3QnIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIHVzZWQgdG8gcHJldmVudCBwb3RlbnRpYWwgbW9kaWZpZXJzICgnaWZ8dW50aWx8d2hpbGV8dW5sZXNzJykgdG8gbWF0Y2hcclxuICAgICAgICAvLyB3aXRoICdlbmQnIGtleXdvcmRzLlxyXG4gICAgICAgIC8vIG1vZGlmaWVyLjxkZWNsPnggd2hlcmUgZGVjbCBpcyB0aGUgZGVjbGFyYXRpb24gc3RhcnRlciwgbGlrZSAnaWYnXHJcbiAgICAgICAgbW9kaWZpZXI6IFtcclxuICAgICAgICAgICAgWy9eLywgJycsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvW2Etel9dXFx3KlshPz1dPy8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZW5kJzogeyB0b2tlbjogJ2tleXdvcmQuJFMyJywgbmV4dDogJ0Bwb3AnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICd0aGVufGVsc2V8ZWxzaWZ8ZG8nOiB7IHRva2VuOiAna2V5d29yZCcsIHN3aXRjaFRvOiAnQHJvb3QuJFMyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGxpbmVkZWNscyc6IHsgdG9rZW46ICdAcmVtYXRjaCcsIHN3aXRjaFRvOiAnQHJvb3QuJFMyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogJ2tleXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGJ1aWx0aW5zJzogJ3ByZWRlZmluZWQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnaWRlbnRpZmllcidcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHJvb3QnIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIHNpbmdsZSBxdW90ZSBzdHJpbmdzIChhbHNvIHVzZWQgZm9yIHN5bWJvbHMpXHJcbiAgICAgICAgLy8gc3N0cmluZy48a2luZD4gIHdoZXJlIGtpbmQgaXMgJ3NxJyAoc2luZ2xlIHF1b3RlKSBvciAncycgKHN5bWJvbClcclxuICAgICAgICBzc3RyaW5nOiBbXHJcbiAgICAgICAgICAgIFsvW15cXFxcJ10rLywgJ3N0cmluZy4kUzInXSxcclxuICAgICAgICAgICAgWy9cXFxcXFxcXHxcXFxcJ3xcXFxcJC8sICdzdHJpbmcuJFMyLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL1xcXFwuLywgJ3N0cmluZy4kUzIuaW52YWxpZCddLFxyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nLiRTMi5kZWxpbScsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gZG91YmxlIHF1b3RlZCBcInN0cmluZ1wiLlxyXG4gICAgICAgIC8vIGRzdHJpbmcuPGtpbmQ+LjxkZWxpbT4gd2hlcmUga2luZCBpcyAnZCcgKGRvdWJsZSBxdW90ZWQpLCAneCcgKGNvbW1hbmQpLCBvciAncycgKHN5bWJvbClcclxuICAgICAgICAvLyBhbmQgZGVsaW0gaXMgdGhlIGVuZGluZyBkZWxpbWl0ZXIgKFwiIG9yIGApXHJcbiAgICAgICAgZHN0cmluZzogW1xyXG4gICAgICAgICAgICBbL1teXFxcXGBcIiNdKy8sICdzdHJpbmcuJFMyJ10sXHJcbiAgICAgICAgICAgIFsvIy8sICdzdHJpbmcuJFMyLmVzY2FwZScsICdAaW50ZXJwb2xhdGVkJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXCQvLCAnc3RyaW5nLiRTMi5lc2NhcGUnXSxcclxuICAgICAgICAgICAgWy9AZXNjYXBlcy8sICdzdHJpbmcuJFMyLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL1xcXFwuLywgJ3N0cmluZy4kUzIuZXNjYXBlLmludmFsaWQnXSxcclxuICAgICAgICAgICAgWy9bYFwiXS8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJCM9PSRTMyc6IHsgdG9rZW46ICdzdHJpbmcuJFMyLmRlbGltJywgbmV4dDogJ0Bwb3AnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdzdHJpbmcuJFMyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBsaXRlcmFsIGRvY3VtZW50c1xyXG4gICAgICAgIC8vIGhlcmVkb2MuPGNsb3NlPiB3aGVyZSBjbG9zZSBpcyB0aGUgY2xvc2luZyBkZWxpbWl0ZXJcclxuICAgICAgICBoZXJlZG9jOiBbXHJcbiAgICAgICAgICAgIFsvXihcXHMqKShAaGVyZWRlbGltKSQvLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJyQyPT0kUzInOiBbJ3N0cmluZy5oZXJlZG9jJywgeyB0b2tlbjogJ3N0cmluZy5oZXJlZG9jLmRlbGltaXRlcicsIG5leHQ6ICdAcG9wJyB9XSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogWydzdHJpbmcuaGVyZWRvYycsICdzdHJpbmcuaGVyZWRvYyddXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgIFsvLiovLCAnc3RyaW5nLmhlcmVkb2MnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIGludGVycG9sYXRlZCBzZXF1ZW5jZVxyXG4gICAgICAgIGludGVycG9sYXRlZDogW1xyXG4gICAgICAgICAgICBbL1xcJFxcdyovLCAnZ2xvYmFsLmNvbnN0YW50JywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9AXFx3Ki8sICduYW1lc3BhY2UuY2xhc3MuaWRlbnRpZmllcicsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvQEBcXHcqLywgJ25hbWVzcGFjZS5pbnN0YW5jZS5pZGVudGlmaWVyJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9be10vLCB7IHRva2VuOiAnc3RyaW5nLmVzY2FwZS5jdXJseScsIHN3aXRjaFRvOiAnQGludGVycG9sYXRlZF9jb21wb3VuZCcgfV0sXHJcbiAgICAgICAgICAgIFsnJywgJycsICdAcG9wJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBhbnkgY29kZVxyXG4gICAgICAgIGludGVycG9sYXRlZF9jb21wb3VuZDogW1xyXG4gICAgICAgICAgICBbL1t9XS8sIHsgdG9rZW46ICdzdHJpbmcuZXNjYXBlLmN1cmx5JywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAcm9vdCcgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vICVyIHF1b3RlZCByZWdleHBcclxuICAgICAgICAvLyBwcmVnZXhwLjxvcGVuPi48Y2xvc2U+IHdoZXJlIG9wZW4vY2xvc2UgYXJlIHRoZSBvcGVuL2Nsb3NlIGRlbGltaXRlclxyXG4gICAgICAgIHByZWdleHA6IFtcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHdoaXRlc3BhY2UnIH0sXHJcbiAgICAgICAgICAgIC8vIHR1cm5zIG91dCB0aGF0IHlvdSBjYW4gcXVvdGUgdXNpbmcgcmVnZXggY29udHJvbCBjaGFyYWN0ZXJzLCBhYXJnaCFcclxuICAgICAgICAgICAgLy8gZm9yIGV4YW1wbGU7ICVyfGtnamdhanwgaXMgb2sgKGV2ZW4gdGhvdWdoIHwgaXMgdXNlZCBmb3IgYWx0ZXJuYXRpb24pXHJcbiAgICAgICAgICAgIC8vIHNvLCB3ZSBuZWVkIHRvIG1hdGNoIHRob3NlIGZpcnN0XHJcbiAgICAgICAgICAgIFsvW15cXChcXHtcXFtcXFxcXS8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJCM9PSRTMyc6IHsgdG9rZW46ICdyZWdleHAuZGVsaW0nLCBuZXh0OiAnQHBvcCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJyQjPT0kUzInOiB7IHRva2VuOiAncmVnZXhwLmRlbGltJywgbmV4dDogJ0BwdXNoJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnflspfVxcXFxdXSc6ICdAYnJhY2tldHMucmVnZXhwLmVzY2FwZS5jb250cm9sJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ35AcmVnZXhwY3RsJzogJ3JlZ2V4cC5lc2NhcGUuY29udHJvbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdyZWdleHAnXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0ByZWdleGNvbnRyb2wnIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBXZSBtYXRjaCByZWd1bGFyIGV4cHJlc3Npb24gcXVpdGUgcHJlY2lzZWx5XHJcbiAgICAgICAgcmVnZXhwOiBbXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0ByZWdleGNvbnRyb2wnIH0sXHJcbiAgICAgICAgICAgIFsvW15cXFxcXFwvXS8sICdyZWdleHAnXSxcclxuICAgICAgICAgICAgWycvW2l4bXBdKicsIHsgdG9rZW46ICdyZWdleHAuZGVsaW0nIH0sICdAcG9wJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZWdleGNvbnRyb2w6IFtcclxuICAgICAgICAgICAgWy8oXFx7KShcXGQrKD86LFxcZCopPykoXFx9KS8sIFsnQGJyYWNrZXRzLnJlZ2V4cC5lc2NhcGUuY29udHJvbCcsICdyZWdleHAuZXNjYXBlLmNvbnRyb2wnLCAnQGJyYWNrZXRzLnJlZ2V4cC5lc2NhcGUuY29udHJvbCddXSxcclxuICAgICAgICAgICAgWy8oXFxbKShcXF4/KS8sIFsnQGJyYWNrZXRzLnJlZ2V4cC5lc2NhcGUuY29udHJvbCcsIHsgdG9rZW46ICdyZWdleHAuZXNjYXBlLmNvbnRyb2wnLCBuZXh0OiAnQHJlZ2V4cmFuZ2UnIH1dXSxcclxuICAgICAgICAgICAgWy8oXFwoKShcXD9bOj0hXSkvLCBbJ0BicmFja2V0cy5yZWdleHAuZXNjYXBlLmNvbnRyb2wnLCAncmVnZXhwLmVzY2FwZS5jb250cm9sJ11dLFxyXG4gICAgICAgICAgICBbL1xcKFxcPyMvLCB7IHRva2VuOiAncmVnZXhwLmVzY2FwZS5jb250cm9sJywgbmV4dDogJ0ByZWdleHBjb21tZW50JyB9XSxcclxuICAgICAgICAgICAgWy9bKCldLywgJ0BicmFja2V0cy5yZWdleHAuZXNjYXBlLmNvbnRyb2wnXSxcclxuICAgICAgICAgICAgWy9AcmVnZXhwY3RsLywgJ3JlZ2V4cC5lc2NhcGUuY29udHJvbCddLFxyXG4gICAgICAgICAgICBbL1xcXFwkLywgJ3JlZ2V4cC5lc2NhcGUnXSxcclxuICAgICAgICAgICAgWy9AcmVnZXhwZXNjLywgJ3JlZ2V4cC5lc2NhcGUnXSxcclxuICAgICAgICAgICAgWy9cXFxcXFwuLywgJ3JlZ2V4cC5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvIy8sICdyZWdleHAuZXNjYXBlJywgJ0BpbnRlcnBvbGF0ZWQnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlZ2V4cmFuZ2U6IFtcclxuICAgICAgICAgICAgWy8tLywgJ3JlZ2V4cC5lc2NhcGUuY29udHJvbCddLFxyXG4gICAgICAgICAgICBbL1xcXi8sICdyZWdleHAuaW52YWxpZCddLFxyXG4gICAgICAgICAgICBbL1xcXFwkLywgJ3JlZ2V4cC5lc2NhcGUnXSxcclxuICAgICAgICAgICAgWy9AcmVnZXhwZXNjLywgJ3JlZ2V4cC5lc2NhcGUnXSxcclxuICAgICAgICAgICAgWy9bXlxcXV0vLCAncmVnZXhwJ10sXHJcbiAgICAgICAgICAgIFsvXFxdLywgJ0BicmFja2V0cy5yZWdleHAuZXNjYXBlLmNvbnRyb2wnLCAnQHBvcCddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVnZXhwY29tbWVudDogW1xyXG4gICAgICAgICAgICBbL1teKV0rLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICAgICAgWy9cXCkvLCB7IHRva2VuOiAncmVnZXhwLmVzY2FwZS5jb250cm9sJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyAlIHF1b3RlZCBzdHJpbmdzXHJcbiAgICAgICAgLy8gQSBiaXQgcmVwZXRpdGl2ZSBzaW5jZSB3ZSBuZWVkIHRvIG9mdGVuIHNwZWNpYWwgY2FzZSB0aGUga2luZCBvZiBlbmRpbmcgZGVsaW1pdGVyXHJcbiAgICAgICAgcHN0cmluZzogW1xyXG4gICAgICAgICAgICBbLyUoW3F3c10pXFwoLywgeyB0b2tlbjogJ3N0cmluZy4kMS5kZWxpbScsIHN3aXRjaFRvOiAnQHFzdHJpbmcuJDEuKC4pJyB9XSxcclxuICAgICAgICAgICAgWy8lKFtxd3NdKVxcWy8sIHsgdG9rZW46ICdzdHJpbmcuJDEuZGVsaW0nLCBzd2l0Y2hUbzogJ0Bxc3RyaW5nLiQxLlsuXScgfV0sXHJcbiAgICAgICAgICAgIFsvJShbcXdzXSlcXHsvLCB7IHRva2VuOiAnc3RyaW5nLiQxLmRlbGltJywgc3dpdGNoVG86ICdAcXN0cmluZy4kMS57Ln0nIH1dLFxyXG4gICAgICAgICAgICBbLyUoW3F3c10pPC8sIHsgdG9rZW46ICdzdHJpbmcuJDEuZGVsaW0nLCBzd2l0Y2hUbzogJ0Bxc3RyaW5nLiQxLjwuPicgfV0sXHJcbiAgICAgICAgICAgIFsvJShbcXdzXSkoQGRlbGltKS8sIHsgdG9rZW46ICdzdHJpbmcuJDEuZGVsaW0nLCBzd2l0Y2hUbzogJ0Bxc3RyaW5nLiQxLiQyLiQyJyB9XSxcclxuICAgICAgICAgICAgWy8lclxcKC8sIHsgdG9rZW46ICdyZWdleHAuZGVsaW0nLCBzd2l0Y2hUbzogJ0BwcmVnZXhwLiguKScgfV0sXHJcbiAgICAgICAgICAgIFsvJXJcXFsvLCB7IHRva2VuOiAncmVnZXhwLmRlbGltJywgc3dpdGNoVG86ICdAcHJlZ2V4cC5bLl0nIH1dLFxyXG4gICAgICAgICAgICBbLyVyXFx7LywgeyB0b2tlbjogJ3JlZ2V4cC5kZWxpbScsIHN3aXRjaFRvOiAnQHByZWdleHAuey59JyB9XSxcclxuICAgICAgICAgICAgWy8lcjwvLCB7IHRva2VuOiAncmVnZXhwLmRlbGltJywgc3dpdGNoVG86ICdAcHJlZ2V4cC48Lj4nIH1dLFxyXG4gICAgICAgICAgICBbLyVyKEBkZWxpbSkvLCB7IHRva2VuOiAncmVnZXhwLmRlbGltJywgc3dpdGNoVG86ICdAcHJlZ2V4cC4kMS4kMScgfV0sXHJcbiAgICAgICAgICAgIFsvJSh4fFd8UT8pXFwoLywgeyB0b2tlbjogJ3N0cmluZy4kMS5kZWxpbScsIHN3aXRjaFRvOiAnQHFxc3RyaW5nLiQxLiguKScgfV0sXHJcbiAgICAgICAgICAgIFsvJSh4fFd8UT8pXFxbLywgeyB0b2tlbjogJ3N0cmluZy4kMS5kZWxpbScsIHN3aXRjaFRvOiAnQHFxc3RyaW5nLiQxLlsuXScgfV0sXHJcbiAgICAgICAgICAgIFsvJSh4fFd8UT8pXFx7LywgeyB0b2tlbjogJ3N0cmluZy4kMS5kZWxpbScsIHN3aXRjaFRvOiAnQHFxc3RyaW5nLiQxLnsufScgfV0sXHJcbiAgICAgICAgICAgIFsvJSh4fFd8UT8pPC8sIHsgdG9rZW46ICdzdHJpbmcuJDEuZGVsaW0nLCBzd2l0Y2hUbzogJ0BxcXN0cmluZy4kMS48Lj4nIH1dLFxyXG4gICAgICAgICAgICBbLyUoeHxXfFE/KShAZGVsaW0pLywgeyB0b2tlbjogJ3N0cmluZy4kMS5kZWxpbScsIHN3aXRjaFRvOiAnQHFxc3RyaW5nLiQxLiQyLiQyJyB9XSxcclxuICAgICAgICAgICAgWy8lKFtycXdzeFddfFE/KS4vLCB7IHRva2VuOiAnaW52YWxpZCcsIG5leHQ6ICdAcG9wJyB9XSxcclxuICAgICAgICAgICAgWy8uLywgeyB0b2tlbjogJ2ludmFsaWQnLCBuZXh0OiAnQHBvcCcgfV0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBub24tZXhwYW5kZWQgcXVvdGVkIHN0cmluZy5cclxuICAgICAgICAvLyBxc3RyaW5nLjxraW5kPi48b3Blbj4uPGNsb3NlPlxyXG4gICAgICAgIC8vICBraW5kID0gcXx3fHMgIChzaW5nbGUgcXVvdGUsIGFycmF5LCBzeW1ib2wpXHJcbiAgICAgICAgLy8gIG9wZW4gPSBvcGVuIGRlbGltaXRlclxyXG4gICAgICAgIC8vICBjbG9zZSA9IGNsb3NlIGRlbGltaXRlclxyXG4gICAgICAgIHFzdHJpbmc6IFtcclxuICAgICAgICAgICAgWy9cXFxcJC8sICdzdHJpbmcuJFMyLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL1xcXFwuLywgJ3N0cmluZy4kUzIuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvLi8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJCM9PSRTNCc6IHsgdG9rZW46ICdzdHJpbmcuJFMyLmRlbGltJywgbmV4dDogJ0Bwb3AnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICckIz09JFMzJzogeyB0b2tlbjogJ3N0cmluZy4kUzIuZGVsaW0nLCBuZXh0OiAnQHB1c2gnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdzdHJpbmcuJFMyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gZXhwYW5kZWQgcXVvdGVkIHN0cmluZy5cclxuICAgICAgICAvLyBxcXN0cmluZy48a2luZD4uPG9wZW4+LjxjbG9zZT5cclxuICAgICAgICAvLyAga2luZCA9IFF8V3x4ICAoZG91YmxlIHF1b3RlLCBhcnJheSwgY29tbWFuZClcclxuICAgICAgICAvLyAgb3BlbiA9IG9wZW4gZGVsaW1pdGVyXHJcbiAgICAgICAgLy8gIGNsb3NlID0gY2xvc2UgZGVsaW1pdGVyXHJcbiAgICAgICAgcXFzdHJpbmc6IFtcclxuICAgICAgICAgICAgWy8jLywgJ3N0cmluZy4kUzIuZXNjYXBlJywgJ0BpbnRlcnBvbGF0ZWQnXSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHFzdHJpbmcnIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIHdoaXRlc3BhY2UgJiBjb21tZW50c1xyXG4gICAgICAgIHdoaXRlc3BhY2U6IFtcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rLywgJyddLFxyXG4gICAgICAgICAgICBbL15cXHMqPWJlZ2luXFxiLywgJ2NvbW1lbnQnLCAnQGNvbW1lbnQnXSxcclxuICAgICAgICAgICAgWy8jLiokLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGNvbW1lbnQ6IFtcclxuICAgICAgICAgICAgWy9bXj1dKy8sICdjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvXlxccyo9YmVnaW5cXGIvLCAnY29tbWVudC5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvXlxccyo9ZW5kXFxiLiovLCAnY29tbWVudCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvWz1dLywgJ2NvbW1lbnQnXVxyXG4gICAgICAgIF0sXHJcbiAgICB9XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiIn0=