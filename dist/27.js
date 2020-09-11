(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[27],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/markdown/markdown.js":
/*!********************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/markdown/markdown.js ***!
  \********************************************************************************/
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
        blockComment: ['<!--', '-->',]
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
        { open: '<', close: '>', notIn: ['string'] }
    ],
    surroundingPairs: [
        { open: '(', close: ')' },
        { open: '[', close: ']' },
        { open: '`', close: '`' },
    ],
    folding: {
        markers: {
            start: new RegExp("^\\s*<!--\\s*#?region\\b.*-->"),
            end: new RegExp("^\\s*<!--\\s*#?endregion\\b.*-->")
        }
    }
};
var language = {
    defaultToken: '',
    tokenPostfix: '.md',
    // escape codes
    control: /[\\`*_\[\]{}()#+\-\.!]/,
    noncontrol: /[^\\`*_\[\]{}()#+\-\.!]/,
    escapes: /\\(?:@control)/,
    // escape codes for javascript/CSS strings
    jsescapes: /\\(?:[btnfr\\"']|[0-7][0-7]?|[0-3][0-7]{2})/,
    // non matched elements
    empty: [
        'area', 'base', 'basefont', 'br', 'col', 'frame',
        'hr', 'img', 'input', 'isindex', 'link', 'meta', 'param'
    ],
    tokenizer: {
        root: [
            // markdown tables
            [/^\s*\|/, '@rematch', '@table_header'],
            // headers (with #)
            [/^(\s{0,3})(#+)((?:[^\\#]|@escapes)+)((?:#+)?)/, ['white', 'keyword', 'keyword', 'keyword']],
            // headers (with =)
            [/^\s*(=+|\-+)\s*$/, 'keyword'],
            // headers (with ***)
            [/^\s*((\*[ ]?)+)\s*$/, 'meta.separator'],
            // quote
            [/^\s*>+/, 'comment'],
            // list (starting with * or number)
            [/^\s*([\*\-+:]|\d+\.)\s/, 'keyword'],
            // code block (4 spaces indent)
            [/^(\t|[ ]{4})[^ ].*$/, 'string'],
            // code block (3 tilde)
            [/^\s*~~~\s*((?:\w|[\/\-#])+)?\s*$/, { token: 'string', next: '@codeblock' }],
            // github style code blocks (with backticks and language)
            [/^\s*```\s*((?:\w|[\/\-#])+).*$/, { token: 'string', next: '@codeblockgh', nextEmbedded: '$1' }],
            // github style code blocks (with backticks but no language)
            [/^\s*```\s*$/, { token: 'string', next: '@codeblock' }],
            // markup within lines
            { include: '@linecontent' },
        ],
        table_header: [
            { include: '@table_common' },
            [/[^\|]+/, 'keyword.table.header'],
        ],
        table_body: [
            { include: '@table_common' },
            { include: '@linecontent' },
        ],
        table_common: [
            [/\s*[\-:]+\s*/, { token: 'keyword', switchTo: 'table_body' }],
            [/^\s*\|/, 'keyword.table.left'],
            [/^\s*[^\|]/, '@rematch', '@pop'],
            [/^\s*$/, '@rematch', '@pop'],
            [/\|/, {
                    cases: {
                        '@eos': 'keyword.table.right',
                        '@default': 'keyword.table.middle',
                    }
                }],
        ],
        codeblock: [
            [/^\s*~~~\s*$/, { token: 'string', next: '@pop' }],
            [/^\s*```\s*$/, { token: 'string', next: '@pop' }],
            [/.*$/, 'variable.source'],
        ],
        // github style code blocks
        codeblockgh: [
            [/```\s*$/, { token: 'variable.source', next: '@pop', nextEmbedded: '@pop' }],
            [/[^`]+/, 'variable.source'],
        ],
        linecontent: [
            // escapes
            [/&\w+;/, 'string.escape'],
            [/@escapes/, 'escape'],
            // various markup
            [/\b__([^\\_]|@escapes|_(?!_))+__\b/, 'strong'],
            [/\*\*([^\\*]|@escapes|\*(?!\*))+\*\*/, 'strong'],
            [/\b_[^_]+_\b/, 'emphasis'],
            [/\*([^\\*]|@escapes)+\*/, 'emphasis'],
            [/`([^\\`]|@escapes)+`/, 'variable'],
            // links
            [/\{+[^}]+\}+/, 'string.target'],
            [/(!?\[)((?:[^\]\\]|@escapes)*)(\]\([^\)]+\))/, ['string.link', '', 'string.link']],
            [/(!?\[)((?:[^\]\\]|@escapes)*)(\])/, 'string.link'],
            // or html
            { include: 'html' },
        ],
        // Note: it is tempting to rather switch to the real HTML mode instead of building our own here
        // but currently there is a limitation in Monarch that prevents us from doing it: The opening
        // '<' would start the HTML mode, however there is no way to jump 1 character back to let the
        // HTML mode also tokenize the opening angle bracket. Thus, even though we could jump to HTML,
        // we cannot correctly tokenize it in that mode yet.
        html: [
            // html tags
            [/<(\w+)\/>/, 'tag'],
            [/<(\w+)/, {
                    cases: {
                        '@empty': { token: 'tag', next: '@tag.$1' },
                        '@default': { token: 'tag', next: '@tag.$1' }
                    }
                }],
            [/<\/(\w+)\s*>/, { token: 'tag' }],
            [/<!--/, 'comment', '@comment']
        ],
        comment: [
            [/[^<\-]+/, 'comment.content'],
            [/-->/, 'comment', '@pop'],
            [/<!--/, 'comment.content.invalid'],
            [/[<\-]/, 'comment.content']
        ],
        // Almost full HTML tag matching, complete with embedded scripts & styles
        tag: [
            [/[ \t\r\n]+/, 'white'],
            [/(type)(\s*=\s*)(")([^"]+)(")/, ['attribute.name.html', 'delimiter.html', 'string.html',
                    { token: 'string.html', switchTo: '@tag.$S2.$4' },
                    'string.html']],
            [/(type)(\s*=\s*)(')([^']+)(')/, ['attribute.name.html', 'delimiter.html', 'string.html',
                    { token: 'string.html', switchTo: '@tag.$S2.$4' },
                    'string.html']],
            [/(\w+)(\s*=\s*)("[^"]*"|'[^']*')/, ['attribute.name.html', 'delimiter.html', 'string.html']],
            [/\w+/, 'attribute.name.html'],
            [/\/>/, 'tag', '@pop'],
            [/>/, {
                    cases: {
                        '$S2==style': { token: 'tag', switchTo: 'embeddedStyle', nextEmbedded: 'text/css' },
                        '$S2==script': {
                            cases: {
                                '$S3': { token: 'tag', switchTo: 'embeddedScript', nextEmbedded: '$S3' },
                                '@default': { token: 'tag', switchTo: 'embeddedScript', nextEmbedded: 'text/javascript' }
                            }
                        },
                        '@default': { token: 'tag', next: '@pop' }
                    }
                }],
        ],
        embeddedStyle: [
            [/[^<]+/, ''],
            [/<\/style\s*>/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }],
            [/</, '']
        ],
        embeddedScript: [
            [/[^<]+/, ''],
            [/<\/script\s*>/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }],
            [/</, '']
        ],
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL21hcmtkb3duL21hcmtkb3duLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNhO0FBQ047QUFDUDtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsV0FBVyxLQUFLO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTO0FBQ1Q7QUFDQTtBQUNBLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBLDBCQUEwQjtBQUMxQiw4QkFBOEI7QUFDOUI7QUFDQTtBQUNBLHdEQUF3RCxFQUFFO0FBQzFEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLElBQUk7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLEVBQUU7QUFDekI7QUFDQSxrREFBa0Qsc0NBQXNDO0FBQ3hGO0FBQ0EsZ0RBQWdELDREQUE0RDtBQUM1RztBQUNBLDZCQUE2QixzQ0FBc0M7QUFDbkU7QUFDQSxhQUFhLDBCQUEwQjtBQUN2QztBQUNBO0FBQ0EsYUFBYSwyQkFBMkI7QUFDeEM7QUFDQTtBQUNBO0FBQ0EsYUFBYSwyQkFBMkI7QUFDeEMsYUFBYSwwQkFBMEI7QUFDdkM7QUFDQTtBQUNBLDhCQUE4QiwyQ0FBMkM7QUFDekU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0EsNkJBQTZCLGdDQUFnQztBQUM3RCw2QkFBNkIsZ0NBQWdDO0FBQzdEO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseUJBQXlCLCtEQUErRDtBQUN4RjtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQjtBQUNuQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWdCLElBQUksSUFBSTtBQUN4QjtBQUNBO0FBQ0E7QUFDQSxhQUFhLGtCQUFrQjtBQUMvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUNBQW1DLGdDQUFnQztBQUNuRSxxQ0FBcUM7QUFDckM7QUFDQSxpQkFBaUI7QUFDakIsOEJBQThCLGVBQWU7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUJBQXFCLGdEQUFnRDtBQUNyRTtBQUNBO0FBQ0EscUJBQXFCLGdEQUFnRDtBQUNyRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1Q0FBdUMsb0VBQW9FO0FBQzNHO0FBQ0E7QUFDQSx3Q0FBd0MsZ0VBQWdFO0FBQ3hHLDZDQUE2QztBQUM3QztBQUNBLHlCQUF5QjtBQUN6QixxQ0FBcUM7QUFDckM7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0EsOEJBQThCLHdEQUF3RDtBQUN0RjtBQUNBO0FBQ0E7QUFDQTtBQUNBLCtCQUErQix3REFBd0Q7QUFDdkY7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiMjcuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5leHBvcnQgdmFyIGNvbmYgPSB7XHJcbiAgICBjb21tZW50czoge1xyXG4gICAgICAgIGJsb2NrQ29tbWVudDogWyc8IS0tJywgJy0tPicsXVxyXG4gICAgfSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgWyd7JywgJ30nXSxcclxuICAgICAgICBbJ1snLCAnXSddLFxyXG4gICAgICAgIFsnKCcsICcpJ11cclxuICAgIF0sXHJcbiAgICBhdXRvQ2xvc2luZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnPCcsIGNsb3NlOiAnPicsIG5vdEluOiBbJ3N0cmluZyddIH1cclxuICAgIF0sXHJcbiAgICBzdXJyb3VuZGluZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2AnLCBjbG9zZTogJ2AnIH0sXHJcbiAgICBdLFxyXG4gICAgZm9sZGluZzoge1xyXG4gICAgICAgIG1hcmtlcnM6IHtcclxuICAgICAgICAgICAgc3RhcnQ6IG5ldyBSZWdFeHAoXCJeXFxcXHMqPCEtLVxcXFxzKiM/cmVnaW9uXFxcXGIuKi0tPlwiKSxcclxuICAgICAgICAgICAgZW5kOiBuZXcgUmVnRXhwKFwiXlxcXFxzKjwhLS1cXFxccyojP2VuZHJlZ2lvblxcXFxiLiotLT5cIilcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcbmV4cG9ydCB2YXIgbGFuZ3VhZ2UgPSB7XHJcbiAgICBkZWZhdWx0VG9rZW46ICcnLFxyXG4gICAgdG9rZW5Qb3N0Zml4OiAnLm1kJyxcclxuICAgIC8vIGVzY2FwZSBjb2Rlc1xyXG4gICAgY29udHJvbDogL1tcXFxcYCpfXFxbXFxde30oKSMrXFwtXFwuIV0vLFxyXG4gICAgbm9uY29udHJvbDogL1teXFxcXGAqX1xcW1xcXXt9KCkjK1xcLVxcLiFdLyxcclxuICAgIGVzY2FwZXM6IC9cXFxcKD86QGNvbnRyb2wpLyxcclxuICAgIC8vIGVzY2FwZSBjb2RlcyBmb3IgamF2YXNjcmlwdC9DU1Mgc3RyaW5nc1xyXG4gICAganNlc2NhcGVzOiAvXFxcXCg/OltidG5mclxcXFxcIiddfFswLTddWzAtN10/fFswLTNdWzAtN117Mn0pLyxcclxuICAgIC8vIG5vbiBtYXRjaGVkIGVsZW1lbnRzXHJcbiAgICBlbXB0eTogW1xyXG4gICAgICAgICdhcmVhJywgJ2Jhc2UnLCAnYmFzZWZvbnQnLCAnYnInLCAnY29sJywgJ2ZyYW1lJyxcclxuICAgICAgICAnaHInLCAnaW1nJywgJ2lucHV0JywgJ2lzaW5kZXgnLCAnbGluaycsICdtZXRhJywgJ3BhcmFtJ1xyXG4gICAgXSxcclxuICAgIHRva2VuaXplcjoge1xyXG4gICAgICAgIHJvb3Q6IFtcclxuICAgICAgICAgICAgLy8gbWFya2Rvd24gdGFibGVzXHJcbiAgICAgICAgICAgIFsvXlxccypcXHwvLCAnQHJlbWF0Y2gnLCAnQHRhYmxlX2hlYWRlciddLFxyXG4gICAgICAgICAgICAvLyBoZWFkZXJzICh3aXRoICMpXHJcbiAgICAgICAgICAgIFsvXihcXHN7MCwzfSkoIyspKCg/OlteXFxcXCNdfEBlc2NhcGVzKSspKCg/OiMrKT8pLywgWyd3aGl0ZScsICdrZXl3b3JkJywgJ2tleXdvcmQnLCAna2V5d29yZCddXSxcclxuICAgICAgICAgICAgLy8gaGVhZGVycyAod2l0aCA9KVxyXG4gICAgICAgICAgICBbL15cXHMqKD0rfFxcLSspXFxzKiQvLCAna2V5d29yZCddLFxyXG4gICAgICAgICAgICAvLyBoZWFkZXJzICh3aXRoICoqKilcclxuICAgICAgICAgICAgWy9eXFxzKigoXFwqWyBdPykrKVxccyokLywgJ21ldGEuc2VwYXJhdG9yJ10sXHJcbiAgICAgICAgICAgIC8vIHF1b3RlXHJcbiAgICAgICAgICAgIFsvXlxccyo+Ky8sICdjb21tZW50J10sXHJcbiAgICAgICAgICAgIC8vIGxpc3QgKHN0YXJ0aW5nIHdpdGggKiBvciBudW1iZXIpXHJcbiAgICAgICAgICAgIFsvXlxccyooW1xcKlxcLSs6XXxcXGQrXFwuKVxccy8sICdrZXl3b3JkJ10sXHJcbiAgICAgICAgICAgIC8vIGNvZGUgYmxvY2sgKDQgc3BhY2VzIGluZGVudClcclxuICAgICAgICAgICAgWy9eKFxcdHxbIF17NH0pW14gXS4qJC8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgLy8gY29kZSBibG9jayAoMyB0aWxkZSlcclxuICAgICAgICAgICAgWy9eXFxzKn5+flxccyooKD86XFx3fFtcXC9cXC0jXSkrKT9cXHMqJC8sIHsgdG9rZW46ICdzdHJpbmcnLCBuZXh0OiAnQGNvZGVibG9jaycgfV0sXHJcbiAgICAgICAgICAgIC8vIGdpdGh1YiBzdHlsZSBjb2RlIGJsb2NrcyAod2l0aCBiYWNrdGlja3MgYW5kIGxhbmd1YWdlKVxyXG4gICAgICAgICAgICBbL15cXHMqYGBgXFxzKigoPzpcXHd8W1xcL1xcLSNdKSspLiokLywgeyB0b2tlbjogJ3N0cmluZycsIG5leHQ6ICdAY29kZWJsb2NrZ2gnLCBuZXh0RW1iZWRkZWQ6ICckMScgfV0sXHJcbiAgICAgICAgICAgIC8vIGdpdGh1YiBzdHlsZSBjb2RlIGJsb2NrcyAod2l0aCBiYWNrdGlja3MgYnV0IG5vIGxhbmd1YWdlKVxyXG4gICAgICAgICAgICBbL15cXHMqYGBgXFxzKiQvLCB7IHRva2VuOiAnc3RyaW5nJywgbmV4dDogJ0Bjb2RlYmxvY2snIH1dLFxyXG4gICAgICAgICAgICAvLyBtYXJrdXAgd2l0aGluIGxpbmVzXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BsaW5lY29udGVudCcgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHRhYmxlX2hlYWRlcjogW1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAdGFibGVfY29tbW9uJyB9LFxyXG4gICAgICAgICAgICBbL1teXFx8XSsvLCAna2V5d29yZC50YWJsZS5oZWFkZXInXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHRhYmxlX2JvZHk6IFtcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHRhYmxlX2NvbW1vbicgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGxpbmVjb250ZW50JyB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgdGFibGVfY29tbW9uOiBbXHJcbiAgICAgICAgICAgIFsvXFxzKltcXC06XStcXHMqLywgeyB0b2tlbjogJ2tleXdvcmQnLCBzd2l0Y2hUbzogJ3RhYmxlX2JvZHknIH1dLFxyXG4gICAgICAgICAgICBbL15cXHMqXFx8LywgJ2tleXdvcmQudGFibGUubGVmdCddLFxyXG4gICAgICAgICAgICBbL15cXHMqW15cXHxdLywgJ0ByZW1hdGNoJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9eXFxzKiQvLCAnQHJlbWF0Y2gnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbL1xcfC8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGVvcyc6ICdrZXl3b3JkLnRhYmxlLnJpZ2h0JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ2tleXdvcmQudGFibGUubWlkZGxlJyxcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGNvZGVibG9jazogW1xyXG4gICAgICAgICAgICBbL15cXHMqfn5+XFxzKiQvLCB7IHRva2VuOiAnc3RyaW5nJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbL15cXHMqYGBgXFxzKiQvLCB7IHRva2VuOiAnc3RyaW5nJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbLy4qJC8sICd2YXJpYWJsZS5zb3VyY2UnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIGdpdGh1YiBzdHlsZSBjb2RlIGJsb2Nrc1xyXG4gICAgICAgIGNvZGVibG9ja2doOiBbXHJcbiAgICAgICAgICAgIFsvYGBgXFxzKiQvLCB7IHRva2VuOiAndmFyaWFibGUuc291cmNlJywgbmV4dDogJ0Bwb3AnLCBuZXh0RW1iZWRkZWQ6ICdAcG9wJyB9XSxcclxuICAgICAgICAgICAgWy9bXmBdKy8sICd2YXJpYWJsZS5zb3VyY2UnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGxpbmVjb250ZW50OiBbXHJcbiAgICAgICAgICAgIC8vIGVzY2FwZXNcclxuICAgICAgICAgICAgWy8mXFx3KzsvLCAnc3RyaW5nLmVzY2FwZSddLFxyXG4gICAgICAgICAgICBbL0Blc2NhcGVzLywgJ2VzY2FwZSddLFxyXG4gICAgICAgICAgICAvLyB2YXJpb3VzIG1hcmt1cFxyXG4gICAgICAgICAgICBbL1xcYl9fKFteXFxcXF9dfEBlc2NhcGVzfF8oPyFfKSkrX19cXGIvLCAnc3Ryb25nJ10sXHJcbiAgICAgICAgICAgIFsvXFwqXFwqKFteXFxcXCpdfEBlc2NhcGVzfFxcKig/IVxcKikpK1xcKlxcKi8sICdzdHJvbmcnXSxcclxuICAgICAgICAgICAgWy9cXGJfW15fXStfXFxiLywgJ2VtcGhhc2lzJ10sXHJcbiAgICAgICAgICAgIFsvXFwqKFteXFxcXCpdfEBlc2NhcGVzKStcXCovLCAnZW1waGFzaXMnXSxcclxuICAgICAgICAgICAgWy9gKFteXFxcXGBdfEBlc2NhcGVzKStgLywgJ3ZhcmlhYmxlJ10sXHJcbiAgICAgICAgICAgIC8vIGxpbmtzXHJcbiAgICAgICAgICAgIFsvXFx7K1tefV0rXFx9Ky8sICdzdHJpbmcudGFyZ2V0J10sXHJcbiAgICAgICAgICAgIFsvKCE/XFxbKSgoPzpbXlxcXVxcXFxdfEBlc2NhcGVzKSopKFxcXVxcKFteXFwpXStcXCkpLywgWydzdHJpbmcubGluaycsICcnLCAnc3RyaW5nLmxpbmsnXV0sXHJcbiAgICAgICAgICAgIFsvKCE/XFxbKSgoPzpbXlxcXVxcXFxdfEBlc2NhcGVzKSopKFxcXSkvLCAnc3RyaW5nLmxpbmsnXSxcclxuICAgICAgICAgICAgLy8gb3IgaHRtbFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdodG1sJyB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gTm90ZTogaXQgaXMgdGVtcHRpbmcgdG8gcmF0aGVyIHN3aXRjaCB0byB0aGUgcmVhbCBIVE1MIG1vZGUgaW5zdGVhZCBvZiBidWlsZGluZyBvdXIgb3duIGhlcmVcclxuICAgICAgICAvLyBidXQgY3VycmVudGx5IHRoZXJlIGlzIGEgbGltaXRhdGlvbiBpbiBNb25hcmNoIHRoYXQgcHJldmVudHMgdXMgZnJvbSBkb2luZyBpdDogVGhlIG9wZW5pbmdcclxuICAgICAgICAvLyAnPCcgd291bGQgc3RhcnQgdGhlIEhUTUwgbW9kZSwgaG93ZXZlciB0aGVyZSBpcyBubyB3YXkgdG8ganVtcCAxIGNoYXJhY3RlciBiYWNrIHRvIGxldCB0aGVcclxuICAgICAgICAvLyBIVE1MIG1vZGUgYWxzbyB0b2tlbml6ZSB0aGUgb3BlbmluZyBhbmdsZSBicmFja2V0LiBUaHVzLCBldmVuIHRob3VnaCB3ZSBjb3VsZCBqdW1wIHRvIEhUTUwsXHJcbiAgICAgICAgLy8gd2UgY2Fubm90IGNvcnJlY3RseSB0b2tlbml6ZSBpdCBpbiB0aGF0IG1vZGUgeWV0LlxyXG4gICAgICAgIGh0bWw6IFtcclxuICAgICAgICAgICAgLy8gaHRtbCB0YWdzXHJcbiAgICAgICAgICAgIFsvPChcXHcrKVxcLz4vLCAndGFnJ10sXHJcbiAgICAgICAgICAgIFsvPChcXHcrKS8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGVtcHR5JzogeyB0b2tlbjogJ3RhZycsIG5leHQ6ICdAdGFnLiQxJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiB7IHRva2VuOiAndGFnJywgbmV4dDogJ0B0YWcuJDEnIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgWy88XFwvKFxcdyspXFxzKj4vLCB7IHRva2VuOiAndGFnJyB9XSxcclxuICAgICAgICAgICAgWy88IS0tLywgJ2NvbW1lbnQnLCAnQGNvbW1lbnQnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29tbWVudDogW1xyXG4gICAgICAgICAgICBbL1tePFxcLV0rLywgJ2NvbW1lbnQuY29udGVudCddLFxyXG4gICAgICAgICAgICBbLy0tPi8sICdjb21tZW50JywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy88IS0tLywgJ2NvbW1lbnQuY29udGVudC5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvWzxcXC1dLywgJ2NvbW1lbnQuY29udGVudCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBBbG1vc3QgZnVsbCBIVE1MIHRhZyBtYXRjaGluZywgY29tcGxldGUgd2l0aCBlbWJlZGRlZCBzY3JpcHRzICYgc3R5bGVzXHJcbiAgICAgICAgdGFnOiBbXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy8sICd3aGl0ZSddLFxyXG4gICAgICAgICAgICBbLyh0eXBlKShcXHMqPVxccyopKFwiKShbXlwiXSspKFwiKS8sIFsnYXR0cmlidXRlLm5hbWUuaHRtbCcsICdkZWxpbWl0ZXIuaHRtbCcsICdzdHJpbmcuaHRtbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgeyB0b2tlbjogJ3N0cmluZy5odG1sJywgc3dpdGNoVG86ICdAdGFnLiRTMi4kNCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAnc3RyaW5nLmh0bWwnXV0sXHJcbiAgICAgICAgICAgIFsvKHR5cGUpKFxccyo9XFxzKikoJykoW14nXSspKCcpLywgWydhdHRyaWJ1dGUubmFtZS5odG1sJywgJ2RlbGltaXRlci5odG1sJywgJ3N0cmluZy5odG1sJyxcclxuICAgICAgICAgICAgICAgICAgICB7IHRva2VuOiAnc3RyaW5nLmh0bWwnLCBzd2l0Y2hUbzogJ0B0YWcuJFMyLiQ0JyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICdzdHJpbmcuaHRtbCddXSxcclxuICAgICAgICAgICAgWy8oXFx3KykoXFxzKj1cXHMqKShcIlteXCJdKlwifCdbXiddKicpLywgWydhdHRyaWJ1dGUubmFtZS5odG1sJywgJ2RlbGltaXRlci5odG1sJywgJ3N0cmluZy5odG1sJ11dLFxyXG4gICAgICAgICAgICBbL1xcdysvLCAnYXR0cmlidXRlLm5hbWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbL1xcLz4vLCAndGFnJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy8+Lywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICckUzI9PXN0eWxlJzogeyB0b2tlbjogJ3RhZycsIHN3aXRjaFRvOiAnZW1iZWRkZWRTdHlsZScsIG5leHRFbWJlZGRlZDogJ3RleHQvY3NzJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJFMyPT1zY3JpcHQnOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICckUzMnOiB7IHRva2VuOiAndGFnJywgc3dpdGNoVG86ICdlbWJlZGRlZFNjcmlwdCcsIG5leHRFbWJlZGRlZDogJyRTMycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiB7IHRva2VuOiAndGFnJywgc3dpdGNoVG86ICdlbWJlZGRlZFNjcmlwdCcsIG5leHRFbWJlZGRlZDogJ3RleHQvamF2YXNjcmlwdCcgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiB7IHRva2VuOiAndGFnJywgbmV4dDogJ0Bwb3AnIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGVtYmVkZGVkU3R5bGU6IFtcclxuICAgICAgICAgICAgWy9bXjxdKy8sICcnXSxcclxuICAgICAgICAgICAgWy88XFwvc3R5bGVcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJywgbmV4dEVtYmVkZGVkOiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIFsvPC8sICcnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgZW1iZWRkZWRTY3JpcHQ6IFtcclxuICAgICAgICAgICAgWy9bXjxdKy8sICcnXSxcclxuICAgICAgICAgICAgWy88XFwvc2NyaXB0XFxzKj4vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcsIG5leHRFbWJlZGRlZDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbLzwvLCAnJ11cclxuICAgICAgICBdLFxyXG4gICAgfVxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9