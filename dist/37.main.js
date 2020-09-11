(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[37],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/postiats/postiats.js":
/*!********************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/postiats/postiats.js ***!
  \********************************************************************************/
/*! exports provided: conf, language */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "conf", function() { return conf; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "language", function() { return language; });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Artyom Shalkhakov. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 *  Based on the ATS/Postiats lexer by Hongwei Xi.
 *--------------------------------------------------------------------------------------------*/

var conf = {
    comments: {
        lineComment: '//',
        blockComment: ['(*', '*)'],
    },
    brackets: [['{', '}'], ['[', ']'], ['(', ')'], ['<', '>']],
    autoClosingPairs: [
        { open: '"', close: '"', notIn: ['string', 'comment'] },
        { open: '{', close: '}', notIn: ['string', 'comment'] },
        { open: '[', close: ']', notIn: ['string', 'comment'] },
        { open: '(', close: ')', notIn: ['string', 'comment'] },
    ]
};
var language = {
    tokenPostfix: '.pats',
    // TODO: staload and dynload are followed by a special kind of string literals
    // with {$IDENTIFER} variables, and it also may make sense to highlight
    // the punctuation (. and / and \) differently.
    // Set defaultToken to invalid to see what you do not tokenize yet
    defaultToken: 'invalid',
    // keyword reference: https://github.com/githwxi/ATS-Postiats/blob/master/src/pats_lexing_token.dats
    keywords: [
        //
        "abstype",
        "abst0ype",
        "absprop",
        "absview",
        "absvtype",
        "absviewtype",
        "absvt0ype",
        "absviewt0ype",
        //
        "as",
        //
        "and",
        //
        "assume",
        //
        "begin",
        //
        /*
                "case", // CASE
        */
        //
        "classdec",
        //
        "datasort",
        //
        "datatype",
        "dataprop",
        "dataview",
        "datavtype",
        "dataviewtype",
        //
        "do",
        //
        "end",
        //
        "extern",
        "extype",
        "extvar",
        //
        "exception",
        //
        "fn",
        "fnx",
        "fun",
        //
        "prfn",
        "prfun",
        //
        "praxi",
        "castfn",
        //
        "if",
        "then",
        "else",
        //
        "ifcase",
        //
        "in",
        //
        "infix",
        "infixl",
        "infixr",
        "prefix",
        "postfix",
        //
        "implmnt",
        "implement",
        //
        "primplmnt",
        "primplement",
        //
        "import",
        //
        /*
                "lam", // LAM
                "llam", // LLAM
                "fix", // FIX
        */
        //
        "let",
        //
        "local",
        //
        "macdef",
        "macrodef",
        //
        "nonfix",
        //
        "symelim",
        "symintr",
        "overload",
        //
        "of",
        "op",
        //
        "rec",
        //
        "sif",
        "scase",
        //
        "sortdef",
        /*
        // HX: [sta] is now deprecated
        */
        "sta",
        "stacst",
        "stadef",
        "static",
        /*
                "stavar", // T_STAVAR
        */
        //
        "staload",
        "dynload",
        //
        "try",
        //
        "tkindef",
        //
        /*
                "type", // TYPE
        */
        "typedef",
        "propdef",
        "viewdef",
        "vtypedef",
        "viewtypedef",
        //
        /*
                "val", // VAL
        */
        "prval",
        //
        "var",
        "prvar",
        //
        "when",
        "where",
        //
        /*
                "for", // T_FOR
                "while", // T_WHILE
        */
        //
        "with",
        //
        "withtype",
        "withprop",
        "withview",
        "withvtype",
        "withviewtype",
    ],
    keywords_dlr: [
        "$delay",
        "$ldelay",
        //
        "$arrpsz",
        "$arrptrsize",
        //
        "$d2ctype",
        //
        "$effmask",
        "$effmask_ntm",
        "$effmask_exn",
        "$effmask_ref",
        "$effmask_wrt",
        "$effmask_all",
        //
        "$extern",
        "$extkind",
        "$extype",
        "$extype_struct",
        //
        "$extval",
        "$extfcall",
        "$extmcall",
        //
        "$literal",
        //
        "$myfilename",
        "$mylocation",
        "$myfunction",
        //
        "$lst",
        "$lst_t",
        "$lst_vt",
        "$list",
        "$list_t",
        "$list_vt",
        //
        "$rec",
        "$rec_t",
        "$rec_vt",
        "$record",
        "$record_t",
        "$record_vt",
        //
        "$tup",
        "$tup_t",
        "$tup_vt",
        "$tuple",
        "$tuple_t",
        "$tuple_vt",
        //
        "$break",
        "$continue",
        //
        "$raise",
        //
        "$showtype",
        //
        "$vcopyenv_v",
        "$vcopyenv_vt",
        //
        "$tempenver",
        //
        "$solver_assert",
        "$solver_verify",
    ],
    keywords_srp: [
        //
        "#if",
        "#ifdef",
        "#ifndef",
        //
        "#then",
        //
        "#elif",
        "#elifdef",
        "#elifndef",
        //
        "#else",
        "#endif",
        //
        "#error",
        //
        "#prerr",
        "#print",
        //
        "#assert",
        //
        "#undef",
        "#define",
        //
        "#include",
        "#require",
        //
        "#pragma",
        "#codegen2",
        "#codegen3",
    ],
    irregular_keyword_list: [
        "val+",
        "val-",
        "val",
        "case+",
        "case-",
        "case",
        "addr@",
        "addr",
        "fold@",
        "free@",
        "fix@",
        "fix",
        "lam@",
        "lam",
        "llam@",
        "llam",
        "viewt@ype+",
        "viewt@ype-",
        "viewt@ype",
        "viewtype+",
        "viewtype-",
        "viewtype",
        "view+",
        "view-",
        "view@",
        "view",
        "type+",
        "type-",
        "type",
        "vtype+",
        "vtype-",
        "vtype",
        "vt@ype+",
        "vt@ype-",
        "vt@ype",
        "viewt@ype+",
        "viewt@ype-",
        "viewt@ype",
        "viewtype+",
        "viewtype-",
        "viewtype",
        "prop+",
        "prop-",
        "prop",
        "type+",
        "type-",
        "type",
        "t@ype",
        "t@ype+",
        "t@ype-",
        "abst@ype",
        "abstype",
        "absviewt@ype",
        "absvt@ype",
        "for*",
        "for",
        "while*",
        "while"
    ],
    keywords_types: [
        'bool',
        'double',
        'byte',
        'int',
        'short',
        'char',
        'void',
        'unit',
        'long',
        'float',
        'string',
        'strptr'
    ],
    // TODO: reference for this?
    keywords_effects: [
        "0",
        "fun",
        "clo",
        "prf",
        "funclo",
        "cloptr",
        "cloref",
        "ref",
        "ntm",
        "1" // all effects
    ],
    operators: [
        "@",
        "!",
        "|",
        "`",
        ":",
        "$",
        ".",
        "=",
        "#",
        "~",
        //
        "..",
        "...",
        //
        "=>",
        // "=<", // T_EQLT
        "=<>",
        "=/=>",
        "=>>",
        "=/=>>",
        //
        "<",
        ">",
        //
        "><",
        //
        ".<",
        ">.",
        //
        ".<>.",
        //
        "->",
        //"-<", // T_MINUSLT
        "-<>",
    ],
    brackets: [
        { open: ',(', close: ')', token: 'delimiter.parenthesis' },
        { open: '`(', close: ')', token: 'delimiter.parenthesis' },
        { open: '%(', close: ')', token: 'delimiter.parenthesis' },
        { open: '\'(', close: ')', token: 'delimiter.parenthesis' },
        { open: '\'{', close: '}', token: 'delimiter.parenthesis' },
        { open: '@(', close: ')', token: 'delimiter.parenthesis' },
        { open: '@{', close: '}', token: 'delimiter.brace' },
        { open: '@[', close: ']', token: 'delimiter.square' },
        { open: '#[', close: ']', token: 'delimiter.square' },
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.square' },
        { open: '(', close: ')', token: 'delimiter.parenthesis' },
        { open: '<', close: '>', token: 'delimiter.angle' }
    ],
    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    IDENTFST: /[a-zA-Z_]/,
    IDENTRST: /[a-zA-Z0-9_'$]/,
    symbolic: /[%&+-./:=@~`^|*!$#?<>]/,
    digit: /[0-9]/,
    digitseq0: /@digit*/,
    xdigit: /[0-9A-Za-z]/,
    xdigitseq0: /@xdigit*/,
    INTSP: /[lLuU]/,
    FLOATSP: /[fFlL]/,
    fexponent: /[eE][+-]?[0-9]+/,
    fexponent_bin: /[pP][+-]?[0-9]+/,
    deciexp: /\.[0-9]*@fexponent?/,
    hexiexp: /\.[0-9a-zA-Z]*@fexponent_bin?/,
    irregular_keywords: /val[+-]?|case[+-]?|addr\@?|fold\@|free\@|fix\@?|lam\@?|llam\@?|prop[+-]?|type[+-]?|view[+-@]?|viewt@?ype[+-]?|t@?ype[+-]?|v(iew)?t@?ype[+-]?|abst@?ype|absv(iew)?t@?ype|for\*?|while\*?/,
    ESCHAR: /[ntvbrfa\\\?'"\(\[\{]/,
    start: 'root',
    // The main tokenizer for ATS/Postiats
    // reference: https://github.com/githwxi/ATS-Postiats/blob/master/src/pats_lexing.dats
    tokenizer: {
        root: [
            // lexing_blankseq0
            { regex: /[ \t\r\n]+/, action: { token: '' } },
            // NOTE: (*) is an invalid ML-like comment!
            { regex: /\(\*\)/, action: { token: 'invalid' } },
            { regex: /\(\*/, action: { token: 'comment', next: 'lexing_COMMENT_block_ml' } },
            { regex: /\(/, action: '@brackets' /*{ token: 'delimiter.parenthesis' }*/ },
            { regex: /\)/, action: '@brackets' /*{ token: 'delimiter.parenthesis' }*/ },
            { regex: /\[/, action: '@brackets' /*{ token: 'delimiter.bracket' }*/ },
            { regex: /\]/, action: '@brackets' /*{ token: 'delimiter.bracket' }*/ },
            { regex: /\{/, action: '@brackets' /*{ token: 'delimiter.brace' }*/ },
            { regex: /\}/, action: '@brackets' /*{ token: 'delimiter.brace' }*/ },
            // lexing_COMMA
            { regex: /,\(/, action: '@brackets' /*{ token: 'delimiter.parenthesis' }*/ },
            { regex: /,/, action: { token: 'delimiter.comma' } },
            { regex: /;/, action: { token: 'delimiter.semicolon' } },
            // lexing_AT
            { regex: /@\(/, action: '@brackets' /* { token: 'delimiter.parenthesis' }*/ },
            { regex: /@\[/, action: '@brackets' /* { token: 'delimiter.bracket' }*/ },
            { regex: /@\{/, action: '@brackets' /*{ token: 'delimiter.brace' }*/ },
            // lexing_COLON
            { regex: /:</, action: { token: 'keyword', next: '@lexing_EFFECT_commaseq0' } },
            /*
            lexing_DOT:

            . // SYMBOLIC => lexing_IDENT_sym
            . FLOATDOT => lexing_FLOAT_deciexp
            . DIGIT => T_DOTINT
            */
            { regex: /\.@symbolic+/, action: { token: 'identifier.sym' } },
            // FLOATDOT case
            { regex: /\.@digit*@fexponent@FLOATSP*/, action: { token: 'number.float' } },
            { regex: /\.@digit+/, action: { token: 'number.float' } },
            // lexing_DOLLAR:
            // '$' IDENTFST IDENTRST* => lexing_IDENT_dlr, _ => lexing_IDENT_sym
            {
                regex: /\$@IDENTFST@IDENTRST*/,
                action: {
                    cases: {
                        '@keywords_dlr': { token: 'keyword.dlr' },
                        '@default': { token: 'namespace' },
                    }
                }
            },
            // lexing_SHARP:
            // '#' IDENTFST IDENTRST* => lexing_ident_srp, _ => lexing_IDENT_sym
            {
                regex: /\#@IDENTFST@IDENTRST*/,
                action: {
                    cases: {
                        '@keywords_srp': { token: 'keyword.srp' },
                        '@default': { token: 'identifier' },
                    }
                }
            },
            // lexing_PERCENT:
            { regex: /%\(/, action: { token: 'delimiter.parenthesis' } },
            { regex: /^%{(#|\^|\$)?/, action: { token: 'keyword', next: '@lexing_EXTCODE', nextEmbedded: 'text/javascript' } },
            { regex: /^%}/, action: { token: 'keyword' } },
            // lexing_QUOTE
            { regex: /'\(/, action: { token: 'delimiter.parenthesis' } },
            { regex: /'\[/, action: { token: 'delimiter.bracket' } },
            { regex: /'\{/, action: { token: 'delimiter.brace' } },
            [/(')(\\@ESCHAR|\\[xX]@xdigit+|\\@digit+)(')/, ['string', 'string.escape', 'string']],
            [/'[^\\']'/, 'string'],
            // lexing_DQUOTE
            [/"/, 'string.quote', '@lexing_DQUOTE'],
            // lexing_BQUOTE
            { regex: /`\(/, action: '@brackets' /* { token: 'delimiter.parenthesis' }*/ },
            // TODO: otherwise, try lexing_IDENT_sym
            { regex: /\\/, action: { token: 'punctuation' } },
            // lexing_IDENT_alp:
            // NOTE: (?!regex) is syntax for "not-followed-by" regex
            // to resolve ambiguity such as foreach$fwork being incorrectly lexed as [for] [each$fwork]!
            { regex: /@irregular_keywords(?!@IDENTRST)/, action: { token: 'keyword' } },
            {
                regex: /@IDENTFST@IDENTRST*[<!\[]?/,
                action: {
                    cases: {
                        // TODO: dynload and staload should be specially parsed
                        // dynload whitespace+ "special_string"
                        // this special string is really:
                        //  '/' '\\' '.' => punctuation
                        // ({\$)([a-zA-Z_][a-zA-Z_0-9]*)(}) => punctuation,keyword,punctuation
                        // [^"] => identifier/literal
                        '@keywords': { token: 'keyword' },
                        '@keywords_types': { token: 'type' },
                        '@default': { token: 'identifier' }
                    }
                }
            },
            // lexing_IDENT_sym:
            { regex: /\/\/\/\//, action: { token: 'comment', next: '@lexing_COMMENT_rest' } },
            { regex: /\/\/.*$/, action: { token: 'comment' } },
            { regex: /\/\*/, action: { token: 'comment', next: '@lexing_COMMENT_block_c' } },
            // AS-20160627: specifically for effect annotations
            { regex: /-<|=</, action: { token: 'keyword', next: '@lexing_EFFECT_commaseq0' } },
            {
                regex: /@symbolic+/,
                action: {
                    cases: {
                        '@operators': 'keyword',
                        '@default': 'operator'
                    }
                }
            },
            // lexing_ZERO:
            // FIXME: this one is quite messy/unfinished yet
            // TODO: lexing_INT_hex
            // - testing_hexiexp => lexing_FLOAT_hexiexp
            // - testing_fexponent_bin => lexing_FLOAT_hexiexp
            // - testing_intspseq0 => T_INT_hex
            // lexing_INT_hex:
            { regex: /0[xX]@xdigit+(@hexiexp|@fexponent_bin)@FLOATSP*/, action: { token: 'number.float' } },
            { regex: /0[xX]@xdigit+@INTSP*/, action: { token: 'number.hex' } },
            { regex: /0[0-7]+(?![0-9])@INTSP*/, action: { token: 'number.octal' } },
            //{regex: /0/, action: { token: 'number' } }, // INTZERO
            // lexing_INT_dec:
            // - testing_deciexp => lexing_FLOAT_deciexp
            // - testing_fexponent => lexing_FLOAT_deciexp
            // - otherwise => intspseq0 ([0-9]*[lLuU]?)
            { regex: /@digit+(@fexponent|@deciexp)@FLOATSP*/, action: { token: 'number.float' } },
            { regex: /@digit@digitseq0@INTSP*/, action: { token: 'number.decimal' } },
            // DIGIT, if followed by digitseq0, is lexing_INT_dec
            { regex: /@digit+@INTSP*/, action: { token: 'number' } },
        ],
        lexing_COMMENT_block_ml: [
            [/[^\(\*]+/, 'comment'],
            [/\(\*/, 'comment', '@push'],
            [/\(\*/, 'comment.invalid'],
            [/\*\)/, 'comment', '@pop'],
            [/\*/, 'comment']
        ],
        lexing_COMMENT_block_c: [
            [/[^\/*]+/, 'comment'],
            // [/\/\*/, 'comment', '@push' ],    // nested C-style block comments not allowed
            // [/\/\*/,    'comment.invalid' ],	// NOTE: this breaks block comments in the shape of /* //*/
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
        ],
        lexing_COMMENT_rest: [
            [/$/, 'comment', '@pop'],
            [/.*/, 'comment']
        ],
        // NOTE: added by AS, specifically for highlighting
        lexing_EFFECT_commaseq0: [
            {
                regex: /@IDENTFST@IDENTRST+|@digit+/,
                action: {
                    cases: {
                        '@keywords_effects': { token: 'type.effect' },
                        '@default': { token: 'identifier' }
                    }
                }
            },
            { regex: /,/, action: { token: 'punctuation' } },
            { regex: />/, action: { token: '@rematch', next: '@pop' } },
        ],
        lexing_EXTCODE: [
            { regex: /^%}/, action: { token: '@rematch', next: '@pop', nextEmbedded: '@pop' } },
            { regex: /[^%]+/, action: '' },
        ],
        lexing_DQUOTE: [
            { regex: /"/, action: { token: 'string.quote', next: '@pop' } },
            // AS-20160628: additional hi-lighting for variables in staload/dynload strings
            { regex: /(\{\$)(@IDENTFST@IDENTRST*)(\})/, action: [{ token: 'string.escape' }, { token: 'identifier' }, { token: 'string.escape' }] },
            { regex: /\\$/, action: { token: 'string.escape' } },
            { regex: /\\(@ESCHAR|[xX]@xdigit+|@digit+)/, action: { token: 'string.escape' } },
            { regex: /[^\\"]+/, action: { token: 'string' } }
        ],
    },
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3Bvc3RpYXRzL3Bvc3RpYXRzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMLGtCQUFrQixLQUFLO0FBQ3ZCO0FBQ0EsU0FBUyxzREFBc0Q7QUFDL0QsU0FBUyxTQUFTLFlBQVksaUNBQWlDO0FBQy9ELFNBQVMsc0RBQXNEO0FBQy9ELFNBQVMsc0RBQXNEO0FBQy9EO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQSxhQUFhLFdBQVc7QUFDeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4Q0FBOEMsdUJBQXVCO0FBQ3JFLHFDQUFxQztBQUNyQztBQUNBO0FBQ0EsYUFBYTtBQUNiLGFBQWEsc0JBQXNCLHVCQUF1QixFQUFFO0FBQzVELGFBQWEsc0JBQXNCLGtDQUFrQyxFQUFFO0FBQ3ZFO0FBQ0E7QUFDQSxhQUFhLFlBQVksWUFBWSx3REFBd0QsRUFBRTtBQUMvRixhQUFhLDZCQUE2QjtBQUMxQztBQUNBO0FBQ0EsYUFBYSxzQkFBc0Isc0NBQXNDLEVBQUU7QUFDM0U7QUFDQSxhQUFhLFlBQVksMkJBQTJCLGNBQWMseUJBQXlCLEdBQUcsc0JBQXNCLEdBQUcseUJBQXlCLEdBQUc7QUFDbkosYUFBYSx3QkFBd0IseUJBQXlCLEVBQUU7QUFDaEUsYUFBYSxxREFBcUQseUJBQXlCLEVBQUU7QUFDN0YsYUFBYSw0QkFBNEIsa0JBQWtCO0FBQzNEO0FBQ0EsS0FBSztBQUNMIiwiZmlsZSI6IjM3Lm1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChjKSBBcnR5b20gU2hhbGtoYWtvdi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXHJcbiAqXHJcbiAqICBCYXNlZCBvbiB0aGUgQVRTL1Bvc3RpYXRzIGxleGVyIGJ5IEhvbmd3ZWkgWGkuXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG4ndXNlIHN0cmljdCc7XHJcbmV4cG9ydCB2YXIgY29uZiA9IHtcclxuICAgIGNvbW1lbnRzOiB7XHJcbiAgICAgICAgbGluZUNvbW1lbnQ6ICcvLycsXHJcbiAgICAgICAgYmxvY2tDb21tZW50OiBbJygqJywgJyopJ10sXHJcbiAgICB9LFxyXG4gICAgYnJhY2tldHM6IFtbJ3snLCAnfSddLCBbJ1snLCAnXSddLCBbJygnLCAnKSddLCBbJzwnLCAnPiddXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXHJcbiAgICBdXHJcbn07XHJcbmV4cG9ydCB2YXIgbGFuZ3VhZ2UgPSB7XHJcbiAgICB0b2tlblBvc3RmaXg6ICcucGF0cycsXHJcbiAgICAvLyBUT0RPOiBzdGFsb2FkIGFuZCBkeW5sb2FkIGFyZSBmb2xsb3dlZCBieSBhIHNwZWNpYWwga2luZCBvZiBzdHJpbmcgbGl0ZXJhbHNcclxuICAgIC8vIHdpdGggeyRJREVOVElGRVJ9IHZhcmlhYmxlcywgYW5kIGl0IGFsc28gbWF5IG1ha2Ugc2Vuc2UgdG8gaGlnaGxpZ2h0XHJcbiAgICAvLyB0aGUgcHVuY3R1YXRpb24gKC4gYW5kIC8gYW5kIFxcKSBkaWZmZXJlbnRseS5cclxuICAgIC8vIFNldCBkZWZhdWx0VG9rZW4gdG8gaW52YWxpZCB0byBzZWUgd2hhdCB5b3UgZG8gbm90IHRva2VuaXplIHlldFxyXG4gICAgZGVmYXVsdFRva2VuOiAnaW52YWxpZCcsXHJcbiAgICAvLyBrZXl3b3JkIHJlZmVyZW5jZTogaHR0cHM6Ly9naXRodWIuY29tL2dpdGh3eGkvQVRTLVBvc3RpYXRzL2Jsb2IvbWFzdGVyL3NyYy9wYXRzX2xleGluZ190b2tlbi5kYXRzXHJcbiAgICBrZXl3b3JkczogW1xyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJhYnN0eXBlXCIsXHJcbiAgICAgICAgXCJhYnN0MHlwZVwiLFxyXG4gICAgICAgIFwiYWJzcHJvcFwiLFxyXG4gICAgICAgIFwiYWJzdmlld1wiLFxyXG4gICAgICAgIFwiYWJzdnR5cGVcIixcclxuICAgICAgICBcImFic3ZpZXd0eXBlXCIsXHJcbiAgICAgICAgXCJhYnN2dDB5cGVcIixcclxuICAgICAgICBcImFic3ZpZXd0MHlwZVwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJhc1wiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJhbmRcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiYXNzdW1lXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcImJlZ2luXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICAvKlxyXG4gICAgICAgICAgICAgICAgXCJjYXNlXCIsIC8vIENBU0VcclxuICAgICAgICAqL1xyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJjbGFzc2RlY1wiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJkYXRhc29ydFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJkYXRhdHlwZVwiLFxyXG4gICAgICAgIFwiZGF0YXByb3BcIixcclxuICAgICAgICBcImRhdGF2aWV3XCIsXHJcbiAgICAgICAgXCJkYXRhdnR5cGVcIixcclxuICAgICAgICBcImRhdGF2aWV3dHlwZVwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJkb1wiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJlbmRcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiZXh0ZXJuXCIsXHJcbiAgICAgICAgXCJleHR5cGVcIixcclxuICAgICAgICBcImV4dHZhclwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJleGNlcHRpb25cIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiZm5cIixcclxuICAgICAgICBcImZueFwiLFxyXG4gICAgICAgIFwiZnVuXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcInByZm5cIixcclxuICAgICAgICBcInByZnVuXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcInByYXhpXCIsXHJcbiAgICAgICAgXCJjYXN0Zm5cIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiaWZcIixcclxuICAgICAgICBcInRoZW5cIixcclxuICAgICAgICBcImVsc2VcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiaWZjYXNlXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcImluXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcImluZml4XCIsXHJcbiAgICAgICAgXCJpbmZpeGxcIixcclxuICAgICAgICBcImluZml4clwiLFxyXG4gICAgICAgIFwicHJlZml4XCIsXHJcbiAgICAgICAgXCJwb3N0Zml4XCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcImltcGxtbnRcIixcclxuICAgICAgICBcImltcGxlbWVudFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJwcmltcGxtbnRcIixcclxuICAgICAgICBcInByaW1wbGVtZW50XCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcImltcG9ydFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgLypcclxuICAgICAgICAgICAgICAgIFwibGFtXCIsIC8vIExBTVxyXG4gICAgICAgICAgICAgICAgXCJsbGFtXCIsIC8vIExMQU1cclxuICAgICAgICAgICAgICAgIFwiZml4XCIsIC8vIEZJWFxyXG4gICAgICAgICovXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcImxldFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJsb2NhbFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJtYWNkZWZcIixcclxuICAgICAgICBcIm1hY3JvZGVmXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIm5vbmZpeFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJzeW1lbGltXCIsXHJcbiAgICAgICAgXCJzeW1pbnRyXCIsXHJcbiAgICAgICAgXCJvdmVybG9hZFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJvZlwiLFxyXG4gICAgICAgIFwib3BcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwicmVjXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcInNpZlwiLFxyXG4gICAgICAgIFwic2Nhc2VcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwic29ydGRlZlwiLFxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgLy8gSFg6IFtzdGFdIGlzIG5vdyBkZXByZWNhdGVkXHJcbiAgICAgICAgKi9cclxuICAgICAgICBcInN0YVwiLFxyXG4gICAgICAgIFwic3RhY3N0XCIsXHJcbiAgICAgICAgXCJzdGFkZWZcIixcclxuICAgICAgICBcInN0YXRpY1wiLFxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICAgICAgICBcInN0YXZhclwiLCAvLyBUX1NUQVZBUlxyXG4gICAgICAgICovXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcInN0YWxvYWRcIixcclxuICAgICAgICBcImR5bmxvYWRcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwidHJ5XCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcInRraW5kZWZcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICAgICAgICBcInR5cGVcIiwgLy8gVFlQRVxyXG4gICAgICAgICovXHJcbiAgICAgICAgXCJ0eXBlZGVmXCIsXHJcbiAgICAgICAgXCJwcm9wZGVmXCIsXHJcbiAgICAgICAgXCJ2aWV3ZGVmXCIsXHJcbiAgICAgICAgXCJ2dHlwZWRlZlwiLFxyXG4gICAgICAgIFwidmlld3R5cGVkZWZcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICAgICAgICBcInZhbFwiLCAvLyBWQUxcclxuICAgICAgICAqL1xyXG4gICAgICAgIFwicHJ2YWxcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwidmFyXCIsXHJcbiAgICAgICAgXCJwcnZhclwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJ3aGVuXCIsXHJcbiAgICAgICAgXCJ3aGVyZVwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgLypcclxuICAgICAgICAgICAgICAgIFwiZm9yXCIsIC8vIFRfRk9SXHJcbiAgICAgICAgICAgICAgICBcIndoaWxlXCIsIC8vIFRfV0hJTEVcclxuICAgICAgICAqL1xyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCJ3aXRoXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIndpdGh0eXBlXCIsXHJcbiAgICAgICAgXCJ3aXRocHJvcFwiLFxyXG4gICAgICAgIFwid2l0aHZpZXdcIixcclxuICAgICAgICBcIndpdGh2dHlwZVwiLFxyXG4gICAgICAgIFwid2l0aHZpZXd0eXBlXCIsXHJcbiAgICBdLFxyXG4gICAga2V5d29yZHNfZGxyOiBbXHJcbiAgICAgICAgXCIkZGVsYXlcIixcclxuICAgICAgICBcIiRsZGVsYXlcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiJGFycnBzelwiLFxyXG4gICAgICAgIFwiJGFycnB0cnNpemVcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiJGQyY3R5cGVcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiJGVmZm1hc2tcIixcclxuICAgICAgICBcIiRlZmZtYXNrX250bVwiLFxyXG4gICAgICAgIFwiJGVmZm1hc2tfZXhuXCIsXHJcbiAgICAgICAgXCIkZWZmbWFza19yZWZcIixcclxuICAgICAgICBcIiRlZmZtYXNrX3dydFwiLFxyXG4gICAgICAgIFwiJGVmZm1hc2tfYWxsXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIiRleHRlcm5cIixcclxuICAgICAgICBcIiRleHRraW5kXCIsXHJcbiAgICAgICAgXCIkZXh0eXBlXCIsXHJcbiAgICAgICAgXCIkZXh0eXBlX3N0cnVjdFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIkZXh0dmFsXCIsXHJcbiAgICAgICAgXCIkZXh0ZmNhbGxcIixcclxuICAgICAgICBcIiRleHRtY2FsbFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIkbGl0ZXJhbFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIkbXlmaWxlbmFtZVwiLFxyXG4gICAgICAgIFwiJG15bG9jYXRpb25cIixcclxuICAgICAgICBcIiRteWZ1bmN0aW9uXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIiRsc3RcIixcclxuICAgICAgICBcIiRsc3RfdFwiLFxyXG4gICAgICAgIFwiJGxzdF92dFwiLFxyXG4gICAgICAgIFwiJGxpc3RcIixcclxuICAgICAgICBcIiRsaXN0X3RcIixcclxuICAgICAgICBcIiRsaXN0X3Z0XCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIiRyZWNcIixcclxuICAgICAgICBcIiRyZWNfdFwiLFxyXG4gICAgICAgIFwiJHJlY192dFwiLFxyXG4gICAgICAgIFwiJHJlY29yZFwiLFxyXG4gICAgICAgIFwiJHJlY29yZF90XCIsXHJcbiAgICAgICAgXCIkcmVjb3JkX3Z0XCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIiR0dXBcIixcclxuICAgICAgICBcIiR0dXBfdFwiLFxyXG4gICAgICAgIFwiJHR1cF92dFwiLFxyXG4gICAgICAgIFwiJHR1cGxlXCIsXHJcbiAgICAgICAgXCIkdHVwbGVfdFwiLFxyXG4gICAgICAgIFwiJHR1cGxlX3Z0XCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIiRicmVha1wiLFxyXG4gICAgICAgIFwiJGNvbnRpbnVlXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIiRyYWlzZVwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIkc2hvd3R5cGVcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiJHZjb3B5ZW52X3ZcIixcclxuICAgICAgICBcIiR2Y29weWVudl92dFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIkdGVtcGVudmVyXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIiRzb2x2ZXJfYXNzZXJ0XCIsXHJcbiAgICAgICAgXCIkc29sdmVyX3ZlcmlmeVwiLFxyXG4gICAgXSxcclxuICAgIGtleXdvcmRzX3NycDogW1xyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIjaWZcIixcclxuICAgICAgICBcIiNpZmRlZlwiLFxyXG4gICAgICAgIFwiI2lmbmRlZlwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIjdGhlblwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIjZWxpZlwiLFxyXG4gICAgICAgIFwiI2VsaWZkZWZcIixcclxuICAgICAgICBcIiNlbGlmbmRlZlwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIjZWxzZVwiLFxyXG4gICAgICAgIFwiI2VuZGlmXCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIiNlcnJvclwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIjcHJlcnJcIixcclxuICAgICAgICBcIiNwcmludFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIjYXNzZXJ0XCIsXHJcbiAgICAgICAgLy9cclxuICAgICAgICBcIiN1bmRlZlwiLFxyXG4gICAgICAgIFwiI2RlZmluZVwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIjaW5jbHVkZVwiLFxyXG4gICAgICAgIFwiI3JlcXVpcmVcIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiI3ByYWdtYVwiLFxyXG4gICAgICAgIFwiI2NvZGVnZW4yXCIsXHJcbiAgICAgICAgXCIjY29kZWdlbjNcIixcclxuICAgIF0sXHJcbiAgICBpcnJlZ3VsYXJfa2V5d29yZF9saXN0OiBbXHJcbiAgICAgICAgXCJ2YWwrXCIsXHJcbiAgICAgICAgXCJ2YWwtXCIsXHJcbiAgICAgICAgXCJ2YWxcIixcclxuICAgICAgICBcImNhc2UrXCIsXHJcbiAgICAgICAgXCJjYXNlLVwiLFxyXG4gICAgICAgIFwiY2FzZVwiLFxyXG4gICAgICAgIFwiYWRkckBcIixcclxuICAgICAgICBcImFkZHJcIixcclxuICAgICAgICBcImZvbGRAXCIsXHJcbiAgICAgICAgXCJmcmVlQFwiLFxyXG4gICAgICAgIFwiZml4QFwiLFxyXG4gICAgICAgIFwiZml4XCIsXHJcbiAgICAgICAgXCJsYW1AXCIsXHJcbiAgICAgICAgXCJsYW1cIixcclxuICAgICAgICBcImxsYW1AXCIsXHJcbiAgICAgICAgXCJsbGFtXCIsXHJcbiAgICAgICAgXCJ2aWV3dEB5cGUrXCIsXHJcbiAgICAgICAgXCJ2aWV3dEB5cGUtXCIsXHJcbiAgICAgICAgXCJ2aWV3dEB5cGVcIixcclxuICAgICAgICBcInZpZXd0eXBlK1wiLFxyXG4gICAgICAgIFwidmlld3R5cGUtXCIsXHJcbiAgICAgICAgXCJ2aWV3dHlwZVwiLFxyXG4gICAgICAgIFwidmlldytcIixcclxuICAgICAgICBcInZpZXctXCIsXHJcbiAgICAgICAgXCJ2aWV3QFwiLFxyXG4gICAgICAgIFwidmlld1wiLFxyXG4gICAgICAgIFwidHlwZStcIixcclxuICAgICAgICBcInR5cGUtXCIsXHJcbiAgICAgICAgXCJ0eXBlXCIsXHJcbiAgICAgICAgXCJ2dHlwZStcIixcclxuICAgICAgICBcInZ0eXBlLVwiLFxyXG4gICAgICAgIFwidnR5cGVcIixcclxuICAgICAgICBcInZ0QHlwZStcIixcclxuICAgICAgICBcInZ0QHlwZS1cIixcclxuICAgICAgICBcInZ0QHlwZVwiLFxyXG4gICAgICAgIFwidmlld3RAeXBlK1wiLFxyXG4gICAgICAgIFwidmlld3RAeXBlLVwiLFxyXG4gICAgICAgIFwidmlld3RAeXBlXCIsXHJcbiAgICAgICAgXCJ2aWV3dHlwZStcIixcclxuICAgICAgICBcInZpZXd0eXBlLVwiLFxyXG4gICAgICAgIFwidmlld3R5cGVcIixcclxuICAgICAgICBcInByb3ArXCIsXHJcbiAgICAgICAgXCJwcm9wLVwiLFxyXG4gICAgICAgIFwicHJvcFwiLFxyXG4gICAgICAgIFwidHlwZStcIixcclxuICAgICAgICBcInR5cGUtXCIsXHJcbiAgICAgICAgXCJ0eXBlXCIsXHJcbiAgICAgICAgXCJ0QHlwZVwiLFxyXG4gICAgICAgIFwidEB5cGUrXCIsXHJcbiAgICAgICAgXCJ0QHlwZS1cIixcclxuICAgICAgICBcImFic3RAeXBlXCIsXHJcbiAgICAgICAgXCJhYnN0eXBlXCIsXHJcbiAgICAgICAgXCJhYnN2aWV3dEB5cGVcIixcclxuICAgICAgICBcImFic3Z0QHlwZVwiLFxyXG4gICAgICAgIFwiZm9yKlwiLFxyXG4gICAgICAgIFwiZm9yXCIsXHJcbiAgICAgICAgXCJ3aGlsZSpcIixcclxuICAgICAgICBcIndoaWxlXCJcclxuICAgIF0sXHJcbiAgICBrZXl3b3Jkc190eXBlczogW1xyXG4gICAgICAgICdib29sJyxcclxuICAgICAgICAnZG91YmxlJyxcclxuICAgICAgICAnYnl0ZScsXHJcbiAgICAgICAgJ2ludCcsXHJcbiAgICAgICAgJ3Nob3J0JyxcclxuICAgICAgICAnY2hhcicsXHJcbiAgICAgICAgJ3ZvaWQnLFxyXG4gICAgICAgICd1bml0JyxcclxuICAgICAgICAnbG9uZycsXHJcbiAgICAgICAgJ2Zsb2F0JyxcclxuICAgICAgICAnc3RyaW5nJyxcclxuICAgICAgICAnc3RycHRyJ1xyXG4gICAgXSxcclxuICAgIC8vIFRPRE86IHJlZmVyZW5jZSBmb3IgdGhpcz9cclxuICAgIGtleXdvcmRzX2VmZmVjdHM6IFtcclxuICAgICAgICBcIjBcIixcclxuICAgICAgICBcImZ1blwiLFxyXG4gICAgICAgIFwiY2xvXCIsXHJcbiAgICAgICAgXCJwcmZcIixcclxuICAgICAgICBcImZ1bmNsb1wiLFxyXG4gICAgICAgIFwiY2xvcHRyXCIsXHJcbiAgICAgICAgXCJjbG9yZWZcIixcclxuICAgICAgICBcInJlZlwiLFxyXG4gICAgICAgIFwibnRtXCIsXHJcbiAgICAgICAgXCIxXCIgLy8gYWxsIGVmZmVjdHNcclxuICAgIF0sXHJcbiAgICBvcGVyYXRvcnM6IFtcclxuICAgICAgICBcIkBcIixcclxuICAgICAgICBcIiFcIixcclxuICAgICAgICBcInxcIixcclxuICAgICAgICBcImBcIixcclxuICAgICAgICBcIjpcIixcclxuICAgICAgICBcIiRcIixcclxuICAgICAgICBcIi5cIixcclxuICAgICAgICBcIj1cIixcclxuICAgICAgICBcIiNcIixcclxuICAgICAgICBcIn5cIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiLi5cIixcclxuICAgICAgICBcIi4uLlwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCI9PlwiLFxyXG4gICAgICAgIC8vIFwiPTxcIiwgLy8gVF9FUUxUXHJcbiAgICAgICAgXCI9PD5cIixcclxuICAgICAgICBcIj0vPT5cIixcclxuICAgICAgICBcIj0+PlwiLFxyXG4gICAgICAgIFwiPS89Pj5cIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiPFwiLFxyXG4gICAgICAgIFwiPlwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCI+PFwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCIuPFwiLFxyXG4gICAgICAgIFwiPi5cIixcclxuICAgICAgICAvL1xyXG4gICAgICAgIFwiLjw+LlwiLFxyXG4gICAgICAgIC8vXHJcbiAgICAgICAgXCItPlwiLFxyXG4gICAgICAgIC8vXCItPFwiLCAvLyBUX01JTlVTTFRcclxuICAgICAgICBcIi08PlwiLFxyXG4gICAgXSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAnLCgnLCBjbG9zZTogJyknLCB0b2tlbjogJ2RlbGltaXRlci5wYXJlbnRoZXNpcycgfSxcclxuICAgICAgICB7IG9wZW46ICdgKCcsIGNsb3NlOiAnKScsIHRva2VuOiAnZGVsaW1pdGVyLnBhcmVudGhlc2lzJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJyUoJywgY2xvc2U6ICcpJywgdG9rZW46ICdkZWxpbWl0ZXIucGFyZW50aGVzaXMnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnKCcsIGNsb3NlOiAnKScsIHRva2VuOiAnZGVsaW1pdGVyLnBhcmVudGhlc2lzJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1xcJ3snLCBjbG9zZTogJ30nLCB0b2tlbjogJ2RlbGltaXRlci5wYXJlbnRoZXNpcycgfSxcclxuICAgICAgICB7IG9wZW46ICdAKCcsIGNsb3NlOiAnKScsIHRva2VuOiAnZGVsaW1pdGVyLnBhcmVudGhlc2lzJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ0B7JywgY2xvc2U6ICd9JywgdG9rZW46ICdkZWxpbWl0ZXIuYnJhY2UnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnQFsnLCBjbG9zZTogJ10nLCB0b2tlbjogJ2RlbGltaXRlci5zcXVhcmUnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnI1snLCBjbG9zZTogJ10nLCB0b2tlbjogJ2RlbGltaXRlci5zcXVhcmUnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScsIHRva2VuOiAnZGVsaW1pdGVyLmN1cmx5JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nLCB0b2tlbjogJ2RlbGltaXRlci5zcXVhcmUnIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScsIHRva2VuOiAnZGVsaW1pdGVyLnBhcmVudGhlc2lzJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJzwnLCBjbG9zZTogJz4nLCB0b2tlbjogJ2RlbGltaXRlci5hbmdsZScgfVxyXG4gICAgXSxcclxuICAgIC8vIHdlIGluY2x1ZGUgdGhlc2UgY29tbW9uIHJlZ3VsYXIgZXhwcmVzc2lvbnNcclxuICAgIHN5bWJvbHM6IC9bPT48IX4/OiZ8K1xcLSpcXC9cXF4lXSsvLFxyXG4gICAgSURFTlRGU1Q6IC9bYS16QS1aX10vLFxyXG4gICAgSURFTlRSU1Q6IC9bYS16QS1aMC05XyckXS8sXHJcbiAgICBzeW1ib2xpYzogL1slJistLi86PUB+YF58KiEkIz88Pl0vLFxyXG4gICAgZGlnaXQ6IC9bMC05XS8sXHJcbiAgICBkaWdpdHNlcTA6IC9AZGlnaXQqLyxcclxuICAgIHhkaWdpdDogL1swLTlBLVphLXpdLyxcclxuICAgIHhkaWdpdHNlcTA6IC9AeGRpZ2l0Ki8sXHJcbiAgICBJTlRTUDogL1tsTHVVXS8sXHJcbiAgICBGTE9BVFNQOiAvW2ZGbExdLyxcclxuICAgIGZleHBvbmVudDogL1tlRV1bKy1dP1swLTldKy8sXHJcbiAgICBmZXhwb25lbnRfYmluOiAvW3BQXVsrLV0/WzAtOV0rLyxcclxuICAgIGRlY2lleHA6IC9cXC5bMC05XSpAZmV4cG9uZW50Py8sXHJcbiAgICBoZXhpZXhwOiAvXFwuWzAtOWEtekEtWl0qQGZleHBvbmVudF9iaW4/LyxcclxuICAgIGlycmVndWxhcl9rZXl3b3JkczogL3ZhbFsrLV0/fGNhc2VbKy1dP3xhZGRyXFxAP3xmb2xkXFxAfGZyZWVcXEB8Zml4XFxAP3xsYW1cXEA/fGxsYW1cXEA/fHByb3BbKy1dP3x0eXBlWystXT98dmlld1srLUBdP3x2aWV3dEA/eXBlWystXT98dEA/eXBlWystXT98dihpZXcpP3RAP3lwZVsrLV0/fGFic3RAP3lwZXxhYnN2KGlldyk/dEA/eXBlfGZvclxcKj98d2hpbGVcXCo/LyxcclxuICAgIEVTQ0hBUjogL1tudHZicmZhXFxcXFxcPydcIlxcKFxcW1xce10vLFxyXG4gICAgc3RhcnQ6ICdyb290JyxcclxuICAgIC8vIFRoZSBtYWluIHRva2VuaXplciBmb3IgQVRTL1Bvc3RpYXRzXHJcbiAgICAvLyByZWZlcmVuY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9naXRod3hpL0FUUy1Qb3N0aWF0cy9ibG9iL21hc3Rlci9zcmMvcGF0c19sZXhpbmcuZGF0c1xyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICAvLyBsZXhpbmdfYmxhbmtzZXEwXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9bIFxcdFxcclxcbl0rLywgYWN0aW9uOiB7IHRva2VuOiAnJyB9IH0sXHJcbiAgICAgICAgICAgIC8vIE5PVEU6ICgqKSBpcyBhbiBpbnZhbGlkIE1MLWxpa2UgY29tbWVudCFcclxuICAgICAgICAgICAgeyByZWdleDogL1xcKFxcKlxcKS8sIGFjdGlvbjogeyB0b2tlbjogJ2ludmFsaWQnIH0gfSxcclxuICAgICAgICAgICAgeyByZWdleDogL1xcKFxcKi8sIGFjdGlvbjogeyB0b2tlbjogJ2NvbW1lbnQnLCBuZXh0OiAnbGV4aW5nX0NPTU1FTlRfYmxvY2tfbWwnIH0gfSxcclxuICAgICAgICAgICAgeyByZWdleDogL1xcKC8sIGFjdGlvbjogJ0BicmFja2V0cycgLyp7IHRva2VuOiAnZGVsaW1pdGVyLnBhcmVudGhlc2lzJyB9Ki8gfSxcclxuICAgICAgICAgICAgeyByZWdleDogL1xcKS8sIGFjdGlvbjogJ0BicmFja2V0cycgLyp7IHRva2VuOiAnZGVsaW1pdGVyLnBhcmVudGhlc2lzJyB9Ki8gfSxcclxuICAgICAgICAgICAgeyByZWdleDogL1xcWy8sIGFjdGlvbjogJ0BicmFja2V0cycgLyp7IHRva2VuOiAnZGVsaW1pdGVyLmJyYWNrZXQnIH0qLyB9LFxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvXFxdLywgYWN0aW9uOiAnQGJyYWNrZXRzJyAvKnsgdG9rZW46ICdkZWxpbWl0ZXIuYnJhY2tldCcgfSovIH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9cXHsvLCBhY3Rpb246ICdAYnJhY2tldHMnIC8qeyB0b2tlbjogJ2RlbGltaXRlci5icmFjZScgfSovIH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9cXH0vLCBhY3Rpb246ICdAYnJhY2tldHMnIC8qeyB0b2tlbjogJ2RlbGltaXRlci5icmFjZScgfSovIH0sXHJcbiAgICAgICAgICAgIC8vIGxleGluZ19DT01NQVxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvLFxcKC8sIGFjdGlvbjogJ0BicmFja2V0cycgLyp7IHRva2VuOiAnZGVsaW1pdGVyLnBhcmVudGhlc2lzJyB9Ki8gfSxcclxuICAgICAgICAgICAgeyByZWdleDogLywvLCBhY3Rpb246IHsgdG9rZW46ICdkZWxpbWl0ZXIuY29tbWEnIH0gfSxcclxuICAgICAgICAgICAgeyByZWdleDogLzsvLCBhY3Rpb246IHsgdG9rZW46ICdkZWxpbWl0ZXIuc2VtaWNvbG9uJyB9IH0sXHJcbiAgICAgICAgICAgIC8vIGxleGluZ19BVFxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvQFxcKC8sIGFjdGlvbjogJ0BicmFja2V0cycgLyogeyB0b2tlbjogJ2RlbGltaXRlci5wYXJlbnRoZXNpcycgfSovIH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9AXFxbLywgYWN0aW9uOiAnQGJyYWNrZXRzJyAvKiB7IHRva2VuOiAnZGVsaW1pdGVyLmJyYWNrZXQnIH0qLyB9LFxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvQFxcey8sIGFjdGlvbjogJ0BicmFja2V0cycgLyp7IHRva2VuOiAnZGVsaW1pdGVyLmJyYWNlJyB9Ki8gfSxcclxuICAgICAgICAgICAgLy8gbGV4aW5nX0NPTE9OXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC86PC8sIGFjdGlvbjogeyB0b2tlbjogJ2tleXdvcmQnLCBuZXh0OiAnQGxleGluZ19FRkZFQ1RfY29tbWFzZXEwJyB9IH0sXHJcbiAgICAgICAgICAgIC8qXHJcbiAgICAgICAgICAgIGxleGluZ19ET1Q6XHJcblxyXG4gICAgICAgICAgICAuIC8vIFNZTUJPTElDID0+IGxleGluZ19JREVOVF9zeW1cclxuICAgICAgICAgICAgLiBGTE9BVERPVCA9PiBsZXhpbmdfRkxPQVRfZGVjaWV4cFxyXG4gICAgICAgICAgICAuIERJR0lUID0+IFRfRE9USU5UXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9cXC5Ac3ltYm9saWMrLywgYWN0aW9uOiB7IHRva2VuOiAnaWRlbnRpZmllci5zeW0nIH0gfSxcclxuICAgICAgICAgICAgLy8gRkxPQVRET1QgY2FzZVxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvXFwuQGRpZ2l0KkBmZXhwb25lbnRARkxPQVRTUCovLCBhY3Rpb246IHsgdG9rZW46ICdudW1iZXIuZmxvYXQnIH0gfSxcclxuICAgICAgICAgICAgeyByZWdleDogL1xcLkBkaWdpdCsvLCBhY3Rpb246IHsgdG9rZW46ICdudW1iZXIuZmxvYXQnIH0gfSxcclxuICAgICAgICAgICAgLy8gbGV4aW5nX0RPTExBUjpcclxuICAgICAgICAgICAgLy8gJyQnIElERU5URlNUIElERU5UUlNUKiA9PiBsZXhpbmdfSURFTlRfZGxyLCBfID0+IGxleGluZ19JREVOVF9zeW1cclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcmVnZXg6IC9cXCRASURFTlRGU1RASURFTlRSU1QqLyxcclxuICAgICAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHNfZGxyJzogeyB0b2tlbjogJ2tleXdvcmQuZGxyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiB7IHRva2VuOiAnbmFtZXNwYWNlJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLy8gbGV4aW5nX1NIQVJQOlxyXG4gICAgICAgICAgICAvLyAnIycgSURFTlRGU1QgSURFTlRSU1QqID0+IGxleGluZ19pZGVudF9zcnAsIF8gPT4gbGV4aW5nX0lERU5UX3N5bVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICByZWdleDogL1xcI0BJREVOVEZTVEBJREVOVFJTVCovLFxyXG4gICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkc19zcnAnOiB7IHRva2VuOiAna2V5d29yZC5zcnAnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6IHsgdG9rZW46ICdpZGVudGlmaWVyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLy8gbGV4aW5nX1BFUkNFTlQ6XHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC8lXFwoLywgYWN0aW9uOiB7IHRva2VuOiAnZGVsaW1pdGVyLnBhcmVudGhlc2lzJyB9IH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9eJXsoI3xcXF58XFwkKT8vLCBhY3Rpb246IHsgdG9rZW46ICdrZXl3b3JkJywgbmV4dDogJ0BsZXhpbmdfRVhUQ09ERScsIG5leHRFbWJlZGRlZDogJ3RleHQvamF2YXNjcmlwdCcgfSB9LFxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvXiV9LywgYWN0aW9uOiB7IHRva2VuOiAna2V5d29yZCcgfSB9LFxyXG4gICAgICAgICAgICAvLyBsZXhpbmdfUVVPVEVcclxuICAgICAgICAgICAgeyByZWdleDogLydcXCgvLCBhY3Rpb246IHsgdG9rZW46ICdkZWxpbWl0ZXIucGFyZW50aGVzaXMnIH0gfSxcclxuICAgICAgICAgICAgeyByZWdleDogLydcXFsvLCBhY3Rpb246IHsgdG9rZW46ICdkZWxpbWl0ZXIuYnJhY2tldCcgfSB9LFxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvJ1xcey8sIGFjdGlvbjogeyB0b2tlbjogJ2RlbGltaXRlci5icmFjZScgfSB9LFxyXG4gICAgICAgICAgICBbLygnKShcXFxcQEVTQ0hBUnxcXFxcW3hYXUB4ZGlnaXQrfFxcXFxAZGlnaXQrKSgnKS8sIFsnc3RyaW5nJywgJ3N0cmluZy5lc2NhcGUnLCAnc3RyaW5nJ11dLFxyXG4gICAgICAgICAgICBbLydbXlxcXFwnXScvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIC8vIGxleGluZ19EUVVPVEVcclxuICAgICAgICAgICAgWy9cIi8sICdzdHJpbmcucXVvdGUnLCAnQGxleGluZ19EUVVPVEUnXSxcclxuICAgICAgICAgICAgLy8gbGV4aW5nX0JRVU9URVxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvYFxcKC8sIGFjdGlvbjogJ0BicmFja2V0cycgLyogeyB0b2tlbjogJ2RlbGltaXRlci5wYXJlbnRoZXNpcycgfSovIH0sXHJcbiAgICAgICAgICAgIC8vIFRPRE86IG90aGVyd2lzZSwgdHJ5IGxleGluZ19JREVOVF9zeW1cclxuICAgICAgICAgICAgeyByZWdleDogL1xcXFwvLCBhY3Rpb246IHsgdG9rZW46ICdwdW5jdHVhdGlvbicgfSB9LFxyXG4gICAgICAgICAgICAvLyBsZXhpbmdfSURFTlRfYWxwOlxyXG4gICAgICAgICAgICAvLyBOT1RFOiAoPyFyZWdleCkgaXMgc3ludGF4IGZvciBcIm5vdC1mb2xsb3dlZC1ieVwiIHJlZ2V4XHJcbiAgICAgICAgICAgIC8vIHRvIHJlc29sdmUgYW1iaWd1aXR5IHN1Y2ggYXMgZm9yZWFjaCRmd29yayBiZWluZyBpbmNvcnJlY3RseSBsZXhlZCBhcyBbZm9yXSBbZWFjaCRmd29ya10hXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9AaXJyZWd1bGFyX2tleXdvcmRzKD8hQElERU5UUlNUKS8sIGFjdGlvbjogeyB0b2tlbjogJ2tleXdvcmQnIH0gfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcmVnZXg6IC9ASURFTlRGU1RASURFTlRSU1QqWzwhXFxbXT8vLFxyXG4gICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogZHlubG9hZCBhbmQgc3RhbG9hZCBzaG91bGQgYmUgc3BlY2lhbGx5IHBhcnNlZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBkeW5sb2FkIHdoaXRlc3BhY2UrIFwic3BlY2lhbF9zdHJpbmdcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGlzIHNwZWNpYWwgc3RyaW5nIGlzIHJlYWxseTpcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICcvJyAnXFxcXCcgJy4nID0+IHB1bmN0dWF0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICh7XFwkKShbYS16QS1aX11bYS16QS1aXzAtOV0qKSh9KSA9PiBwdW5jdHVhdGlvbixrZXl3b3JkLHB1bmN0dWF0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFteXCJdID0+IGlkZW50aWZpZXIvbGl0ZXJhbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogeyB0b2tlbjogJ2tleXdvcmQnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHNfdHlwZXMnOiB7IHRva2VuOiAndHlwZScgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogeyB0b2tlbjogJ2lkZW50aWZpZXInIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8vIGxleGluZ19JREVOVF9zeW06XHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9cXC9cXC9cXC9cXC8vLCBhY3Rpb246IHsgdG9rZW46ICdjb21tZW50JywgbmV4dDogJ0BsZXhpbmdfQ09NTUVOVF9yZXN0JyB9IH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9cXC9cXC8uKiQvLCBhY3Rpb246IHsgdG9rZW46ICdjb21tZW50JyB9IH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9cXC9cXCovLCBhY3Rpb246IHsgdG9rZW46ICdjb21tZW50JywgbmV4dDogJ0BsZXhpbmdfQ09NTUVOVF9ibG9ja19jJyB9IH0sXHJcbiAgICAgICAgICAgIC8vIEFTLTIwMTYwNjI3OiBzcGVjaWZpY2FsbHkgZm9yIGVmZmVjdCBhbm5vdGF0aW9uc1xyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvLTx8PTwvLCBhY3Rpb246IHsgdG9rZW46ICdrZXl3b3JkJywgbmV4dDogJ0BsZXhpbmdfRUZGRUNUX2NvbW1hc2VxMCcgfSB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICByZWdleDogL0BzeW1ib2xpYysvLFxyXG4gICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BvcGVyYXRvcnMnOiAna2V5d29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdvcGVyYXRvcidcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8vIGxleGluZ19aRVJPOlxyXG4gICAgICAgICAgICAvLyBGSVhNRTogdGhpcyBvbmUgaXMgcXVpdGUgbWVzc3kvdW5maW5pc2hlZCB5ZXRcclxuICAgICAgICAgICAgLy8gVE9ETzogbGV4aW5nX0lOVF9oZXhcclxuICAgICAgICAgICAgLy8gLSB0ZXN0aW5nX2hleGlleHAgPT4gbGV4aW5nX0ZMT0FUX2hleGlleHBcclxuICAgICAgICAgICAgLy8gLSB0ZXN0aW5nX2ZleHBvbmVudF9iaW4gPT4gbGV4aW5nX0ZMT0FUX2hleGlleHBcclxuICAgICAgICAgICAgLy8gLSB0ZXN0aW5nX2ludHNwc2VxMCA9PiBUX0lOVF9oZXhcclxuICAgICAgICAgICAgLy8gbGV4aW5nX0lOVF9oZXg6XHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC8wW3hYXUB4ZGlnaXQrKEBoZXhpZXhwfEBmZXhwb25lbnRfYmluKUBGTE9BVFNQKi8sIGFjdGlvbjogeyB0b2tlbjogJ251bWJlci5mbG9hdCcgfSB9LFxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvMFt4WF1AeGRpZ2l0K0BJTlRTUCovLCBhY3Rpb246IHsgdG9rZW46ICdudW1iZXIuaGV4JyB9IH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC8wWzAtN10rKD8hWzAtOV0pQElOVFNQKi8sIGFjdGlvbjogeyB0b2tlbjogJ251bWJlci5vY3RhbCcgfSB9LFxyXG4gICAgICAgICAgICAvL3tyZWdleDogLzAvLCBhY3Rpb246IHsgdG9rZW46ICdudW1iZXInIH0gfSwgLy8gSU5UWkVST1xyXG4gICAgICAgICAgICAvLyBsZXhpbmdfSU5UX2RlYzpcclxuICAgICAgICAgICAgLy8gLSB0ZXN0aW5nX2RlY2lleHAgPT4gbGV4aW5nX0ZMT0FUX2RlY2lleHBcclxuICAgICAgICAgICAgLy8gLSB0ZXN0aW5nX2ZleHBvbmVudCA9PiBsZXhpbmdfRkxPQVRfZGVjaWV4cFxyXG4gICAgICAgICAgICAvLyAtIG90aGVyd2lzZSA9PiBpbnRzcHNlcTAgKFswLTldKltsTHVVXT8pXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9AZGlnaXQrKEBmZXhwb25lbnR8QGRlY2lleHApQEZMT0FUU1AqLywgYWN0aW9uOiB7IHRva2VuOiAnbnVtYmVyLmZsb2F0JyB9IH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9AZGlnaXRAZGlnaXRzZXEwQElOVFNQKi8sIGFjdGlvbjogeyB0b2tlbjogJ251bWJlci5kZWNpbWFsJyB9IH0sXHJcbiAgICAgICAgICAgIC8vIERJR0lULCBpZiBmb2xsb3dlZCBieSBkaWdpdHNlcTAsIGlzIGxleGluZ19JTlRfZGVjXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9AZGlnaXQrQElOVFNQKi8sIGFjdGlvbjogeyB0b2tlbjogJ251bWJlcicgfSB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbGV4aW5nX0NPTU1FTlRfYmxvY2tfbWw6IFtcclxuICAgICAgICAgICAgWy9bXlxcKFxcKl0rLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICAgICAgWy9cXChcXCovLCAnY29tbWVudCcsICdAcHVzaCddLFxyXG4gICAgICAgICAgICBbL1xcKFxcKi8sICdjb21tZW50LmludmFsaWQnXSxcclxuICAgICAgICAgICAgWy9cXCpcXCkvLCAnY29tbWVudCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvXFwqLywgJ2NvbW1lbnQnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbGV4aW5nX0NPTU1FTlRfYmxvY2tfYzogW1xyXG4gICAgICAgICAgICBbL1teXFwvKl0rLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICAgICAgLy8gWy9cXC9cXCovLCAnY29tbWVudCcsICdAcHVzaCcgXSwgICAgLy8gbmVzdGVkIEMtc3R5bGUgYmxvY2sgY29tbWVudHMgbm90IGFsbG93ZWRcclxuICAgICAgICAgICAgLy8gWy9cXC9cXCovLCAgICAnY29tbWVudC5pbnZhbGlkJyBdLFx0Ly8gTk9URTogdGhpcyBicmVha3MgYmxvY2sgY29tbWVudHMgaW4gdGhlIHNoYXBlIG9mIC8qIC8vKi9cclxuICAgICAgICAgICAgWy9cXCpcXC8vLCAnY29tbWVudCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvW1xcLypdLywgJ2NvbW1lbnQnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbGV4aW5nX0NPTU1FTlRfcmVzdDogW1xyXG4gICAgICAgICAgICBbLyQvLCAnY29tbWVudCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvLiovLCAnY29tbWVudCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBOT1RFOiBhZGRlZCBieSBBUywgc3BlY2lmaWNhbGx5IGZvciBoaWdobGlnaHRpbmdcclxuICAgICAgICBsZXhpbmdfRUZGRUNUX2NvbW1hc2VxMDogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICByZWdleDogL0BJREVOVEZTVEBJREVOVFJTVCt8QGRpZ2l0Ky8sXHJcbiAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzX2VmZmVjdHMnOiB7IHRva2VuOiAndHlwZS5lZmZlY3QnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6IHsgdG9rZW46ICdpZGVudGlmaWVyJyB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvLC8sIGFjdGlvbjogeyB0b2tlbjogJ3B1bmN0dWF0aW9uJyB9IH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC8+LywgYWN0aW9uOiB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcgfSB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbGV4aW5nX0VYVENPREU6IFtcclxuICAgICAgICAgICAgeyByZWdleDogL14lfS8sIGFjdGlvbjogeyB0b2tlbjogJ0ByZW1hdGNoJywgbmV4dDogJ0Bwb3AnLCBuZXh0RW1iZWRkZWQ6ICdAcG9wJyB9IH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9bXiVdKy8sIGFjdGlvbjogJycgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGxleGluZ19EUVVPVEU6IFtcclxuICAgICAgICAgICAgeyByZWdleDogL1wiLywgYWN0aW9uOiB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgbmV4dDogJ0Bwb3AnIH0gfSxcclxuICAgICAgICAgICAgLy8gQVMtMjAxNjA2Mjg6IGFkZGl0aW9uYWwgaGktbGlnaHRpbmcgZm9yIHZhcmlhYmxlcyBpbiBzdGFsb2FkL2R5bmxvYWQgc3RyaW5nc1xyXG4gICAgICAgICAgICB7IHJlZ2V4OiAvKFxce1xcJCkoQElERU5URlNUQElERU5UUlNUKikoXFx9KS8sIGFjdGlvbjogW3sgdG9rZW46ICdzdHJpbmcuZXNjYXBlJyB9LCB7IHRva2VuOiAnaWRlbnRpZmllcicgfSwgeyB0b2tlbjogJ3N0cmluZy5lc2NhcGUnIH1dIH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9cXFxcJC8sIGFjdGlvbjogeyB0b2tlbjogJ3N0cmluZy5lc2NhcGUnIH0gfSxcclxuICAgICAgICAgICAgeyByZWdleDogL1xcXFwoQEVTQ0hBUnxbeFhdQHhkaWdpdCt8QGRpZ2l0KykvLCBhY3Rpb246IHsgdG9rZW46ICdzdHJpbmcuZXNjYXBlJyB9IH0sXHJcbiAgICAgICAgICAgIHsgcmVnZXg6IC9bXlxcXFxcIl0rLywgYWN0aW9uOiB7IHRva2VuOiAnc3RyaW5nJyB9IH1cclxuICAgICAgICBdLFxyXG4gICAgfSxcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIifQ==