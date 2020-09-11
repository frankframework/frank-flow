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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL21hcmtkb3duL21hcmtkb3duLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNhO0FBQ047QUFDUDtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsV0FBVyxLQUFLO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTO0FBQ1Q7QUFDQTtBQUNBLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBLDBCQUEwQjtBQUMxQiw4QkFBOEI7QUFDOUI7QUFDQTtBQUNBLHdEQUF3RCxFQUFFO0FBQzFEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLElBQUk7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLEVBQUU7QUFDekI7QUFDQSxrREFBa0Qsc0NBQXNDO0FBQ3hGO0FBQ0EsZ0RBQWdELDREQUE0RDtBQUM1RztBQUNBLDZCQUE2QixzQ0FBc0M7QUFDbkU7QUFDQSxhQUFhLDBCQUEwQjtBQUN2QztBQUNBO0FBQ0EsYUFBYSwyQkFBMkI7QUFDeEM7QUFDQTtBQUNBO0FBQ0EsYUFBYSwyQkFBMkI7QUFDeEMsYUFBYSwwQkFBMEI7QUFDdkM7QUFDQTtBQUNBLDhCQUE4QiwyQ0FBMkM7QUFDekU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0EsNkJBQTZCLGdDQUFnQztBQUM3RCw2QkFBNkIsZ0NBQWdDO0FBQzdEO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseUJBQXlCLCtEQUErRDtBQUN4RjtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQjtBQUNuQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWdCLElBQUksSUFBSTtBQUN4QjtBQUNBO0FBQ0E7QUFDQSxhQUFhLGtCQUFrQjtBQUMvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUNBQW1DLGdDQUFnQztBQUNuRSxxQ0FBcUM7QUFDckM7QUFDQSxpQkFBaUI7QUFDakIsOEJBQThCLGVBQWU7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUJBQXFCLGdEQUFnRDtBQUNyRTtBQUNBO0FBQ0EscUJBQXFCLGdEQUFnRDtBQUNyRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1Q0FBdUMsb0VBQW9FO0FBQzNHO0FBQ0E7QUFDQSx3Q0FBd0MsZ0VBQWdFO0FBQ3hHLDZDQUE2QztBQUM3QztBQUNBLHlCQUF5QjtBQUN6QixxQ0FBcUM7QUFDckM7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0EsOEJBQThCLHdEQUF3RDtBQUN0RjtBQUNBO0FBQ0E7QUFDQTtBQUNBLCtCQUErQix3REFBd0Q7QUFDdkY7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiMjcubWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG4ndXNlIHN0cmljdCc7XHJcbmV4cG9ydCB2YXIgY29uZiA9IHtcclxuICAgIGNvbW1lbnRzOiB7XHJcbiAgICAgICAgYmxvY2tDb21tZW50OiBbJzwhLS0nLCAnLS0+JyxdXHJcbiAgICB9LFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICBbJ3snLCAnfSddLFxyXG4gICAgICAgIFsnWycsICddJ10sXHJcbiAgICAgICAgWycoJywgJyknXVxyXG4gICAgXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICc8JywgY2xvc2U6ICc+Jywgbm90SW46IFsnc3RyaW5nJ10gfVxyXG4gICAgXSxcclxuICAgIHN1cnJvdW5kaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnYCcsIGNsb3NlOiAnYCcgfSxcclxuICAgIF0sXHJcbiAgICBmb2xkaW5nOiB7XHJcbiAgICAgICAgbWFya2Vyczoge1xyXG4gICAgICAgICAgICBzdGFydDogbmV3IFJlZ0V4cChcIl5cXFxccyo8IS0tXFxcXHMqIz9yZWdpb25cXFxcYi4qLS0+XCIpLFxyXG4gICAgICAgICAgICBlbmQ6IG5ldyBSZWdFeHAoXCJeXFxcXHMqPCEtLVxcXFxzKiM/ZW5kcmVnaW9uXFxcXGIuKi0tPlwiKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuZXhwb3J0IHZhciBsYW5ndWFnZSA9IHtcclxuICAgIGRlZmF1bHRUb2tlbjogJycsXHJcbiAgICB0b2tlblBvc3RmaXg6ICcubWQnLFxyXG4gICAgLy8gZXNjYXBlIGNvZGVzXHJcbiAgICBjb250cm9sOiAvW1xcXFxgKl9cXFtcXF17fSgpIytcXC1cXC4hXS8sXHJcbiAgICBub25jb250cm9sOiAvW15cXFxcYCpfXFxbXFxde30oKSMrXFwtXFwuIV0vLFxyXG4gICAgZXNjYXBlczogL1xcXFwoPzpAY29udHJvbCkvLFxyXG4gICAgLy8gZXNjYXBlIGNvZGVzIGZvciBqYXZhc2NyaXB0L0NTUyBzdHJpbmdzXHJcbiAgICBqc2VzY2FwZXM6IC9cXFxcKD86W2J0bmZyXFxcXFwiJ118WzAtN11bMC03XT98WzAtM11bMC03XXsyfSkvLFxyXG4gICAgLy8gbm9uIG1hdGNoZWQgZWxlbWVudHNcclxuICAgIGVtcHR5OiBbXHJcbiAgICAgICAgJ2FyZWEnLCAnYmFzZScsICdiYXNlZm9udCcsICdicicsICdjb2wnLCAnZnJhbWUnLFxyXG4gICAgICAgICdocicsICdpbWcnLCAnaW5wdXQnLCAnaXNpbmRleCcsICdsaW5rJywgJ21ldGEnLCAncGFyYW0nXHJcbiAgICBdLFxyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICAvLyBtYXJrZG93biB0YWJsZXNcclxuICAgICAgICAgICAgWy9eXFxzKlxcfC8sICdAcmVtYXRjaCcsICdAdGFibGVfaGVhZGVyJ10sXHJcbiAgICAgICAgICAgIC8vIGhlYWRlcnMgKHdpdGggIylcclxuICAgICAgICAgICAgWy9eKFxcc3swLDN9KSgjKykoKD86W15cXFxcI118QGVzY2FwZXMpKykoKD86IyspPykvLCBbJ3doaXRlJywgJ2tleXdvcmQnLCAna2V5d29yZCcsICdrZXl3b3JkJ11dLFxyXG4gICAgICAgICAgICAvLyBoZWFkZXJzICh3aXRoID0pXHJcbiAgICAgICAgICAgIFsvXlxccyooPSt8XFwtKylcXHMqJC8sICdrZXl3b3JkJ10sXHJcbiAgICAgICAgICAgIC8vIGhlYWRlcnMgKHdpdGggKioqKVxyXG4gICAgICAgICAgICBbL15cXHMqKChcXCpbIF0/KSspXFxzKiQvLCAnbWV0YS5zZXBhcmF0b3InXSxcclxuICAgICAgICAgICAgLy8gcXVvdGVcclxuICAgICAgICAgICAgWy9eXFxzKj4rLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICAgICAgLy8gbGlzdCAoc3RhcnRpbmcgd2l0aCAqIG9yIG51bWJlcilcclxuICAgICAgICAgICAgWy9eXFxzKihbXFwqXFwtKzpdfFxcZCtcXC4pXFxzLywgJ2tleXdvcmQnXSxcclxuICAgICAgICAgICAgLy8gY29kZSBibG9jayAoNCBzcGFjZXMgaW5kZW50KVxyXG4gICAgICAgICAgICBbL14oXFx0fFsgXXs0fSlbXiBdLiokLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICAvLyBjb2RlIGJsb2NrICgzIHRpbGRlKVxyXG4gICAgICAgICAgICBbL15cXHMqfn5+XFxzKigoPzpcXHd8W1xcL1xcLSNdKSspP1xccyokLywgeyB0b2tlbjogJ3N0cmluZycsIG5leHQ6ICdAY29kZWJsb2NrJyB9XSxcclxuICAgICAgICAgICAgLy8gZ2l0aHViIHN0eWxlIGNvZGUgYmxvY2tzICh3aXRoIGJhY2t0aWNrcyBhbmQgbGFuZ3VhZ2UpXHJcbiAgICAgICAgICAgIFsvXlxccypgYGBcXHMqKCg/Olxcd3xbXFwvXFwtI10pKykuKiQvLCB7IHRva2VuOiAnc3RyaW5nJywgbmV4dDogJ0Bjb2RlYmxvY2tnaCcsIG5leHRFbWJlZGRlZDogJyQxJyB9XSxcclxuICAgICAgICAgICAgLy8gZ2l0aHViIHN0eWxlIGNvZGUgYmxvY2tzICh3aXRoIGJhY2t0aWNrcyBidXQgbm8gbGFuZ3VhZ2UpXHJcbiAgICAgICAgICAgIFsvXlxccypgYGBcXHMqJC8sIHsgdG9rZW46ICdzdHJpbmcnLCBuZXh0OiAnQGNvZGVibG9jaycgfV0sXHJcbiAgICAgICAgICAgIC8vIG1hcmt1cCB3aXRoaW4gbGluZXNcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGxpbmVjb250ZW50JyB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgdGFibGVfaGVhZGVyOiBbXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B0YWJsZV9jb21tb24nIH0sXHJcbiAgICAgICAgICAgIFsvW15cXHxdKy8sICdrZXl3b3JkLnRhYmxlLmhlYWRlciddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgdGFibGVfYm9keTogW1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAdGFibGVfY29tbW9uJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAbGluZWNvbnRlbnQnIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICB0YWJsZV9jb21tb246IFtcclxuICAgICAgICAgICAgWy9cXHMqW1xcLTpdK1xccyovLCB7IHRva2VuOiAna2V5d29yZCcsIHN3aXRjaFRvOiAndGFibGVfYm9keScgfV0sXHJcbiAgICAgICAgICAgIFsvXlxccypcXHwvLCAna2V5d29yZC50YWJsZS5sZWZ0J10sXHJcbiAgICAgICAgICAgIFsvXlxccypbXlxcfF0vLCAnQHJlbWF0Y2gnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbL15cXHMqJC8sICdAcmVtYXRjaCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvXFx8Lywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZW9zJzogJ2tleXdvcmQudGFibGUucmlnaHQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAna2V5d29yZC50YWJsZS5taWRkbGUnLFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY29kZWJsb2NrOiBbXHJcbiAgICAgICAgICAgIFsvXlxccyp+fn5cXHMqJC8sIHsgdG9rZW46ICdzdHJpbmcnLCBuZXh0OiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIFsvXlxccypgYGBcXHMqJC8sIHsgdG9rZW46ICdzdHJpbmcnLCBuZXh0OiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIFsvLiokLywgJ3ZhcmlhYmxlLnNvdXJjZSddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gZ2l0aHViIHN0eWxlIGNvZGUgYmxvY2tzXHJcbiAgICAgICAgY29kZWJsb2NrZ2g6IFtcclxuICAgICAgICAgICAgWy9gYGBcXHMqJC8sIHsgdG9rZW46ICd2YXJpYWJsZS5zb3VyY2UnLCBuZXh0OiAnQHBvcCcsIG5leHRFbWJlZGRlZDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbL1teYF0rLywgJ3ZhcmlhYmxlLnNvdXJjZSddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbGluZWNvbnRlbnQ6IFtcclxuICAgICAgICAgICAgLy8gZXNjYXBlc1xyXG4gICAgICAgICAgICBbLyZcXHcrOy8sICdzdHJpbmcuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvQGVzY2FwZXMvLCAnZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIC8vIHZhcmlvdXMgbWFya3VwXHJcbiAgICAgICAgICAgIFsvXFxiX18oW15cXFxcX118QGVzY2FwZXN8Xyg/IV8pKStfX1xcYi8sICdzdHJvbmcnXSxcclxuICAgICAgICAgICAgWy9cXCpcXCooW15cXFxcKl18QGVzY2FwZXN8XFwqKD8hXFwqKSkrXFwqXFwqLywgJ3N0cm9uZyddLFxyXG4gICAgICAgICAgICBbL1xcYl9bXl9dK19cXGIvLCAnZW1waGFzaXMnXSxcclxuICAgICAgICAgICAgWy9cXCooW15cXFxcKl18QGVzY2FwZXMpK1xcKi8sICdlbXBoYXNpcyddLFxyXG4gICAgICAgICAgICBbL2AoW15cXFxcYF18QGVzY2FwZXMpK2AvLCAndmFyaWFibGUnXSxcclxuICAgICAgICAgICAgLy8gbGlua3NcclxuICAgICAgICAgICAgWy9cXHsrW159XStcXH0rLywgJ3N0cmluZy50YXJnZXQnXSxcclxuICAgICAgICAgICAgWy8oIT9cXFspKCg/OlteXFxdXFxcXF18QGVzY2FwZXMpKikoXFxdXFwoW15cXCldK1xcKSkvLCBbJ3N0cmluZy5saW5rJywgJycsICdzdHJpbmcubGluayddXSxcclxuICAgICAgICAgICAgWy8oIT9cXFspKCg/OlteXFxdXFxcXF18QGVzY2FwZXMpKikoXFxdKS8sICdzdHJpbmcubGluayddLFxyXG4gICAgICAgICAgICAvLyBvciBodG1sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ2h0bWwnIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBOb3RlOiBpdCBpcyB0ZW1wdGluZyB0byByYXRoZXIgc3dpdGNoIHRvIHRoZSByZWFsIEhUTUwgbW9kZSBpbnN0ZWFkIG9mIGJ1aWxkaW5nIG91ciBvd24gaGVyZVxyXG4gICAgICAgIC8vIGJ1dCBjdXJyZW50bHkgdGhlcmUgaXMgYSBsaW1pdGF0aW9uIGluIE1vbmFyY2ggdGhhdCBwcmV2ZW50cyB1cyBmcm9tIGRvaW5nIGl0OiBUaGUgb3BlbmluZ1xyXG4gICAgICAgIC8vICc8JyB3b3VsZCBzdGFydCB0aGUgSFRNTCBtb2RlLCBob3dldmVyIHRoZXJlIGlzIG5vIHdheSB0byBqdW1wIDEgY2hhcmFjdGVyIGJhY2sgdG8gbGV0IHRoZVxyXG4gICAgICAgIC8vIEhUTUwgbW9kZSBhbHNvIHRva2VuaXplIHRoZSBvcGVuaW5nIGFuZ2xlIGJyYWNrZXQuIFRodXMsIGV2ZW4gdGhvdWdoIHdlIGNvdWxkIGp1bXAgdG8gSFRNTCxcclxuICAgICAgICAvLyB3ZSBjYW5ub3QgY29ycmVjdGx5IHRva2VuaXplIGl0IGluIHRoYXQgbW9kZSB5ZXQuXHJcbiAgICAgICAgaHRtbDogW1xyXG4gICAgICAgICAgICAvLyBodG1sIHRhZ3NcclxuICAgICAgICAgICAgWy88KFxcdyspXFwvPi8sICd0YWcnXSxcclxuICAgICAgICAgICAgWy88KFxcdyspLywge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZW1wdHknOiB7IHRva2VuOiAndGFnJywgbmV4dDogJ0B0YWcuJDEnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6IHsgdG9rZW46ICd0YWcnLCBuZXh0OiAnQHRhZy4kMScgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgICAgICBbLzxcXC8oXFx3KylcXHMqPi8sIHsgdG9rZW46ICd0YWcnIH1dLFxyXG4gICAgICAgICAgICBbLzwhLS0vLCAnY29tbWVudCcsICdAY29tbWVudCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjb21tZW50OiBbXHJcbiAgICAgICAgICAgIFsvW148XFwtXSsvLCAnY29tbWVudC5jb250ZW50J10sXHJcbiAgICAgICAgICAgIFsvLS0+LywgJ2NvbW1lbnQnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbLzwhLS0vLCAnY29tbWVudC5jb250ZW50LmludmFsaWQnXSxcclxuICAgICAgICAgICAgWy9bPFxcLV0vLCAnY29tbWVudC5jb250ZW50J11cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEFsbW9zdCBmdWxsIEhUTUwgdGFnIG1hdGNoaW5nLCBjb21wbGV0ZSB3aXRoIGVtYmVkZGVkIHNjcmlwdHMgJiBzdHlsZXNcclxuICAgICAgICB0YWc6IFtcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rLywgJ3doaXRlJ10sXHJcbiAgICAgICAgICAgIFsvKHR5cGUpKFxccyo9XFxzKikoXCIpKFteXCJdKykoXCIpLywgWydhdHRyaWJ1dGUubmFtZS5odG1sJywgJ2RlbGltaXRlci5odG1sJywgJ3N0cmluZy5odG1sJyxcclxuICAgICAgICAgICAgICAgICAgICB7IHRva2VuOiAnc3RyaW5nLmh0bWwnLCBzd2l0Y2hUbzogJ0B0YWcuJFMyLiQ0JyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICdzdHJpbmcuaHRtbCddXSxcclxuICAgICAgICAgICAgWy8odHlwZSkoXFxzKj1cXHMqKSgnKShbXiddKykoJykvLCBbJ2F0dHJpYnV0ZS5uYW1lLmh0bWwnLCAnZGVsaW1pdGVyLmh0bWwnLCAnc3RyaW5nLmh0bWwnLFxyXG4gICAgICAgICAgICAgICAgICAgIHsgdG9rZW46ICdzdHJpbmcuaHRtbCcsIHN3aXRjaFRvOiAnQHRhZy4kUzIuJDQnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgJ3N0cmluZy5odG1sJ11dLFxyXG4gICAgICAgICAgICBbLyhcXHcrKShcXHMqPVxccyopKFwiW15cIl0qXCJ8J1teJ10qJykvLCBbJ2F0dHJpYnV0ZS5uYW1lLmh0bWwnLCAnZGVsaW1pdGVyLmh0bWwnLCAnc3RyaW5nLmh0bWwnXV0sXHJcbiAgICAgICAgICAgIFsvXFx3Ky8sICdhdHRyaWJ1dGUubmFtZS5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvXFwvPi8sICd0YWcnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbLz4vLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJyRTMj09c3R5bGUnOiB7IHRva2VuOiAndGFnJywgc3dpdGNoVG86ICdlbWJlZGRlZFN0eWxlJywgbmV4dEVtYmVkZGVkOiAndGV4dC9jc3MnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICckUzI9PXNjcmlwdCc6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyRTMyc6IHsgdG9rZW46ICd0YWcnLCBzd2l0Y2hUbzogJ2VtYmVkZGVkU2NyaXB0JywgbmV4dEVtYmVkZGVkOiAnJFMzJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6IHsgdG9rZW46ICd0YWcnLCBzd2l0Y2hUbzogJ2VtYmVkZGVkU2NyaXB0JywgbmV4dEVtYmVkZGVkOiAndGV4dC9qYXZhc2NyaXB0JyB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6IHsgdG9rZW46ICd0YWcnLCBuZXh0OiAnQHBvcCcgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgZW1iZWRkZWRTdHlsZTogW1xyXG4gICAgICAgICAgICBbL1tePF0rLywgJyddLFxyXG4gICAgICAgICAgICBbLzxcXC9zdHlsZVxccyo+LywgeyB0b2tlbjogJ0ByZW1hdGNoJywgbmV4dDogJ0Bwb3AnLCBuZXh0RW1iZWRkZWQ6ICdAcG9wJyB9XSxcclxuICAgICAgICAgICAgWy88LywgJyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICBlbWJlZGRlZFNjcmlwdDogW1xyXG4gICAgICAgICAgICBbL1tePF0rLywgJyddLFxyXG4gICAgICAgICAgICBbLzxcXC9zY3JpcHRcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJywgbmV4dEVtYmVkZGVkOiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIFsvPC8sICcnXVxyXG4gICAgICAgIF0sXHJcbiAgICB9XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiIn0=