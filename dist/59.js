(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[59],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/twig/twig.js":
/*!************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/twig/twig.js ***!
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
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
    comments: {
        blockComment: ['{#', '#}'],
    },
    brackets: [
        ['{#', '#}'],
        ['{%', '%}'],
        ['{{', '}}'],
        ['(', ')'],
        ['[', ']'],
        // HTML
        ['<!--', '-->'],
        ['<', '>'],
    ],
    autoClosingPairs: [
        { open: '{# ', close: ' #}' },
        { open: '{% ', close: ' %}' },
        { open: '{{ ', close: ' }}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
    ],
    surroundingPairs: [
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        // HTML
        { open: '<', close: '>' },
    ],
};
var language = {
    defaultToken: '',
    tokenPostfix: '',
    ignoreCase: true,
    keywords: [
        // (opening) tags
        'apply', 'autoescape', 'block', 'deprecated', 'do', 'embed', 'extends',
        'flush', 'for', 'from', 'if', 'import', 'include', 'macro', 'sandbox',
        'set', 'use', 'verbatim', 'with',
        // closing tags
        'endapply', 'endautoescape', 'endblock', 'endembed', 'endfor', 'endif',
        'endmacro', 'endsandbox', 'endset', 'endwith',
        // literals
        'true', 'false',
    ],
    tokenizer: {
        root: [
            // whitespace
            [/\s+/],
            // Twig Tag Delimiters
            [/{#/, 'comment.twig', '@commentState'],
            [/{%[-~]?/, 'delimiter.twig', '@blockState'],
            [/{{[-~]?/, 'delimiter.twig', '@variableState'],
            // HTML
            [/<!DOCTYPE/, 'metatag.html', '@doctype'],
            [/<!--/, 'comment.html', '@comment'],
            [/(<)((?:[\w\-]+:)?[\w\-]+)(\s*)(\/>)/, ['delimiter.html', 'tag.html', '', 'delimiter.html']],
            [/(<)(script)/, ['delimiter.html', { token: 'tag.html', next: '@script' }]],
            [/(<)(style)/, ['delimiter.html', { token: 'tag.html', next: '@style' }]],
            [/(<)((?:[\w\-]+:)?[\w\-]+)/, ['delimiter.html', { token: 'tag.html', next: '@otherTag' }]],
            [/(<\/)((?:[\w\-]+:)?[\w\-]+)/, ['delimiter.html', { token: 'tag.html', next: '@otherTag' }]],
            [/</, 'delimiter.html'],
            [/[^<]+/],
        ],
        /**
         * Comment Tag Handling
         */
        commentState: [
            [/#}/, 'comment.twig', '@pop'],
            [/./, 'comment.twig'],
        ],
        /**
         * Block Tag Handling
         */
        blockState: [
            [/[-~]?%}/, 'delimiter.twig', '@pop'],
            // whitespace
            [/\s+/],
            // verbatim
            // Unlike other blocks, verbatim ehas its own state
            // transition to ensure we mark its contents as strings.
            [/(verbatim)(\s*)([-~]?%})/, [
                    'keyword.twig',
                    '',
                    { token: 'delimiter.twig', next: '@rawDataState' },
                ]],
            { include: 'expression' }
        ],
        rawDataState: [
            // endverbatim
            [/({%[-~]?)(\s*)(endverbatim)(\s*)([-~]?%})/, [
                    'delimiter.twig',
                    '',
                    'keyword.twig',
                    '',
                    { token: 'delimiter.twig', next: '@popall' },
                ]],
            [/./, 'string.twig'],
        ],
        /**
         * Variable Tag Handling
         */
        variableState: [
            [/[-~]?}}/, 'delimiter.twig', '@pop'],
            { include: 'expression' },
        ],
        stringState: [
            // closing double quoted string
            [/"/, 'string.twig', '@pop'],
            // interpolation start
            [/#{\s*/, 'string.twig', '@interpolationState'],
            // string part
            [/[^#"\\]*(?:(?:\\.|#(?!\{))[^#"\\]*)*/, 'string.twig'],
        ],
        interpolationState: [
            // interpolation end
            [/}/, 'string.twig', '@pop'],
            { include: 'expression' },
        ],
        /**
         * Expression Handling
         */
        expression: [
            // whitespace
            [/\s+/],
            // operators - math
            [/\+|-|\/{1,2}|%|\*{1,2}/, 'operators.twig'],
            // operators - logic
            [/(and|or|not|b-and|b-xor|b-or)(\s+)/, ['operators.twig', '']],
            // operators - comparison (symbols)
            [/==|!=|<|>|>=|<=/, 'operators.twig'],
            // operators - comparison (words)
            [/(starts with|ends with|matches)(\s+)/, ['operators.twig', '']],
            // operators - containment
            [/(in)(\s+)/, ['operators.twig', '']],
            // operators - test
            [/(is)(\s+)/, ['operators.twig', '']],
            // operators - misc
            [/\||~|:|\.{1,2}|\?{1,2}/, 'operators.twig'],
            // names
            [/[^\W\d][\w]*/, {
                    cases: {
                        '@keywords': 'keyword.twig',
                        '@default': 'variable.twig'
                    }
                }],
            // numbers
            [/\d+(\.\d+)?/, 'number.twig'],
            // punctuation
            [/\(|\)|\[|\]|{|}|,/, 'delimiter.twig'],
            // strings
            [/"([^#"\\]*(?:\\.[^#"\\]*)*)"|\'([^\'\\]*(?:\\.[^\'\\]*)*)\'/, 'string.twig'],
            // opening double quoted string
            [/"/, 'string.twig', '@stringState'],
            // misc syntactic constructs
            // These are not operators per se, but for the purposes of lexical analysis we
            // can treat them as such.
            // arrow functions
            [/=>/, 'operators.twig'],
            // assignment
            [/=/, 'operators.twig'],
        ],
        /**
         * HTML
         */
        doctype: [
            [/[^>]+/, 'metatag.content.html'],
            [/>/, 'metatag.html', '@pop'],
        ],
        comment: [
            [/-->/, 'comment.html', '@pop'],
            [/[^-]+/, 'comment.content.html'],
            [/./, 'comment.content.html']
        ],
        otherTag: [
            [/\/?>/, 'delimiter.html', '@pop'],
            [/"([^"]*)"/, 'attribute.value.html'],
            [/'([^']*)'/, 'attribute.value.html'],
            [/[\w\-]+/, 'attribute.name.html'],
            [/=/, 'delimiter.html'],
            [/[ \t\r\n]+/],
        ],
        // -- BEGIN <script> tags handling
        // After <script
        script: [
            [/type/, 'attribute.name.html', '@scriptAfterType'],
            [/"([^"]*)"/, 'attribute.value.html'],
            [/'([^']*)'/, 'attribute.value.html'],
            [/[\w\-]+/, 'attribute.name.html'],
            [/=/, 'delimiter.html'],
            [/>/, { token: 'delimiter.html', next: '@scriptEmbedded', nextEmbedded: 'text/javascript' }],
            [/[ \t\r\n]+/],
            [/(<\/)(script\s*)(>)/, ['delimiter.html', 'tag.html', { token: 'delimiter.html', next: '@pop' }]]
        ],
        // After <script ... type
        scriptAfterType: [
            [/=/, 'delimiter.html', '@scriptAfterTypeEquals'],
            [/>/, { token: 'delimiter.html', next: '@scriptEmbedded', nextEmbedded: 'text/javascript' }],
            [/[ \t\r\n]+/],
            [/<\/script\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        // After <script ... type =
        scriptAfterTypeEquals: [
            [/"([^"]*)"/, { token: 'attribute.value.html', switchTo: '@scriptWithCustomType.$1' }],
            [/'([^']*)'/, { token: 'attribute.value.html', switchTo: '@scriptWithCustomType.$1' }],
            [/>/, { token: 'delimiter.html', next: '@scriptEmbedded', nextEmbedded: 'text/javascript' }],
            [/[ \t\r\n]+/],
            [/<\/script\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        // After <script ... type = $S2
        scriptWithCustomType: [
            [/>/, { token: 'delimiter.html', next: '@scriptEmbedded.$S2', nextEmbedded: '$S2' }],
            [/"([^"]*)"/, 'attribute.value.html'],
            [/'([^']*)'/, 'attribute.value.html'],
            [/[\w\-]+/, 'attribute.name.html'],
            [/=/, 'delimiter.html'],
            [/[ \t\r\n]+/],
            [/<\/script\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        scriptEmbedded: [
            [/<\/script/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }],
            [/[^<]+/, '']
        ],
        // -- END <script> tags handling
        // -- BEGIN <style> tags handling
        // After <style
        style: [
            [/type/, 'attribute.name.html', '@styleAfterType'],
            [/"([^"]*)"/, 'attribute.value.html'],
            [/'([^']*)'/, 'attribute.value.html'],
            [/[\w\-]+/, 'attribute.name.html'],
            [/=/, 'delimiter.html'],
            [/>/, { token: 'delimiter.html', next: '@styleEmbedded', nextEmbedded: 'text/css' }],
            [/[ \t\r\n]+/],
            [/(<\/)(style\s*)(>)/, ['delimiter.html', 'tag.html', { token: 'delimiter.html', next: '@pop' }]]
        ],
        // After <style ... type
        styleAfterType: [
            [/=/, 'delimiter.html', '@styleAfterTypeEquals'],
            [/>/, { token: 'delimiter.html', next: '@styleEmbedded', nextEmbedded: 'text/css' }],
            [/[ \t\r\n]+/],
            [/<\/style\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        // After <style ... type =
        styleAfterTypeEquals: [
            [/"([^"]*)"/, { token: 'attribute.value.html', switchTo: '@styleWithCustomType.$1' }],
            [/'([^']*)'/, { token: 'attribute.value.html', switchTo: '@styleWithCustomType.$1' }],
            [/>/, { token: 'delimiter.html', next: '@styleEmbedded', nextEmbedded: 'text/css' }],
            [/[ \t\r\n]+/],
            [/<\/style\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        // After <style ... type = $S2
        styleWithCustomType: [
            [/>/, { token: 'delimiter.html', next: '@styleEmbedded.$S2', nextEmbedded: '$S2' }],
            [/"([^"]*)"/, 'attribute.value.html'],
            [/'([^']*)'/, 'attribute.value.html'],
            [/[\w\-]+/, 'attribute.name.html'],
            [/=/, 'delimiter.html'],
            [/[ \t\r\n]+/],
            [/<\/style\s*>/, { token: '@rematch', next: '@pop' }]
        ],
        styleEmbedded: [
            [/<\/style/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }],
            [/[^<]+/, '']
        ],
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3R3aWcvdHdpZy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1AsZ0VBQWdFLElBQUksTUFBTTtBQUMxRTtBQUNBLHlCQUF5QixPQUFPO0FBQ2hDLEtBQUs7QUFDTDtBQUNBLFdBQVcsT0FBTztBQUNsQixXQUFXLE9BQU87QUFDbEIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLGdCQUFnQixHQUFHO0FBQ3JDLFNBQVMsU0FBUyxnQkFBZ0IsR0FBRztBQUNyQyxTQUFTLFVBQVUsZUFBZSxHQUFHO0FBQ3JDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCO0FBQ25DO0FBQ0E7QUFDQSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBLFNBQVMsd0JBQXdCO0FBQ2pDO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZTtBQUNmLGVBQWU7QUFDZixnQkFBZ0I7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnREFBZ0QscUNBQXFDO0FBQ3JGLCtDQUErQyxvQ0FBb0M7QUFDbkYsOERBQThELHVDQUF1QztBQUNyRyxnRUFBZ0UsdUNBQXVDO0FBQ3ZHO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWdCO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQjtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUNBQXFDO0FBQ3JDO0FBQ0E7QUFDQSxxQkFBcUIsaURBQWlEO0FBQ3RFO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBLGdCQUFnQixzQ0FBc0M7QUFDdEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQkFBcUIsMkNBQTJDO0FBQ2hFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUJBQXFCO0FBQ3JCLGFBQWEsd0JBQXdCO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnQkFBZ0I7QUFDaEI7QUFDQSxzQ0FBc0M7QUFDdEM7QUFDQTtBQUNBO0FBQ0EsZUFBZTtBQUNmLGFBQWEsd0JBQXdCO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0IsSUFBSSxNQUFNLElBQUk7QUFDcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixJQUFJLElBQUksSUFBSTtBQUNwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0EsMkJBQTJCLEVBQUU7QUFDN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsb0ZBQW9GO0FBQ3ZHO0FBQ0Esb0VBQW9FLHdDQUF3QztBQUM1RztBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQixvRkFBb0Y7QUFDdkc7QUFDQSwrQkFBK0Isa0NBQWtDO0FBQ2pFO0FBQ0E7QUFDQTtBQUNBLDJCQUEyQixzRUFBc0U7QUFDakcsMkJBQTJCLHNFQUFzRTtBQUNqRyxtQkFBbUIsb0ZBQW9GO0FBQ3ZHO0FBQ0EsK0JBQStCLGtDQUFrQztBQUNqRTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsNEVBQTRFO0FBQy9GO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrQkFBK0Isa0NBQWtDO0FBQ2pFO0FBQ0E7QUFDQSwyQkFBMkIsd0RBQXdEO0FBQ25GO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsNEVBQTRFO0FBQy9GO0FBQ0EsbUVBQW1FLHdDQUF3QztBQUMzRztBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQiw0RUFBNEU7QUFDL0Y7QUFDQSw4QkFBOEIsa0NBQWtDO0FBQ2hFO0FBQ0E7QUFDQTtBQUNBLDJCQUEyQixxRUFBcUU7QUFDaEcsMkJBQTJCLHFFQUFxRTtBQUNoRyxtQkFBbUIsNEVBQTRFO0FBQy9GO0FBQ0EsOEJBQThCLGtDQUFrQztBQUNoRTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsMkVBQTJFO0FBQzlGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4QkFBOEIsa0NBQWtDO0FBQ2hFO0FBQ0E7QUFDQSwwQkFBMEIsd0RBQXdEO0FBQ2xGO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IjU5LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgd29yZFBhdHRlcm46IC8oLT9cXGQqXFwuXFxkXFx3Kil8KFteXFxgXFx+XFwhXFxAXFwkXFxeXFwmXFwqXFwoXFwpXFw9XFwrXFxbXFx7XFxdXFx9XFxcXFxcfFxcO1xcOlxcJ1xcXCJcXCxcXC5cXDxcXD5cXC9cXHNdKykvZyxcclxuICAgIGNvbW1lbnRzOiB7XHJcbiAgICAgICAgYmxvY2tDb21tZW50OiBbJ3sjJywgJyN9J10sXHJcbiAgICB9LFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICBbJ3sjJywgJyN9J10sXHJcbiAgICAgICAgWyd7JScsICclfSddLFxyXG4gICAgICAgIFsne3snLCAnfX0nXSxcclxuICAgICAgICBbJygnLCAnKSddLFxyXG4gICAgICAgIFsnWycsICddJ10sXHJcbiAgICAgICAgLy8gSFRNTFxyXG4gICAgICAgIFsnPCEtLScsICctLT4nXSxcclxuICAgICAgICBbJzwnLCAnPiddLFxyXG4gICAgXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7IyAnLCBjbG9zZTogJyAjfScgfSxcclxuICAgICAgICB7IG9wZW46ICd7JSAnLCBjbG9zZTogJyAlfScgfSxcclxuICAgICAgICB7IG9wZW46ICd7eyAnLCBjbG9zZTogJyB9fScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXCInLCBjbG9zZTogJ1wiJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJyB9LFxyXG4gICAgXSxcclxuICAgIHN1cnJvdW5kaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICAgICAgLy8gSFRNTFxyXG4gICAgICAgIHsgb3BlbjogJzwnLCBjbG9zZTogJz4nIH0sXHJcbiAgICBdLFxyXG59O1xyXG5leHBvcnQgdmFyIGxhbmd1YWdlID0ge1xyXG4gICAgZGVmYXVsdFRva2VuOiAnJyxcclxuICAgIHRva2VuUG9zdGZpeDogJycsXHJcbiAgICBpZ25vcmVDYXNlOiB0cnVlLFxyXG4gICAga2V5d29yZHM6IFtcclxuICAgICAgICAvLyAob3BlbmluZykgdGFnc1xyXG4gICAgICAgICdhcHBseScsICdhdXRvZXNjYXBlJywgJ2Jsb2NrJywgJ2RlcHJlY2F0ZWQnLCAnZG8nLCAnZW1iZWQnLCAnZXh0ZW5kcycsXHJcbiAgICAgICAgJ2ZsdXNoJywgJ2ZvcicsICdmcm9tJywgJ2lmJywgJ2ltcG9ydCcsICdpbmNsdWRlJywgJ21hY3JvJywgJ3NhbmRib3gnLFxyXG4gICAgICAgICdzZXQnLCAndXNlJywgJ3ZlcmJhdGltJywgJ3dpdGgnLFxyXG4gICAgICAgIC8vIGNsb3NpbmcgdGFnc1xyXG4gICAgICAgICdlbmRhcHBseScsICdlbmRhdXRvZXNjYXBlJywgJ2VuZGJsb2NrJywgJ2VuZGVtYmVkJywgJ2VuZGZvcicsICdlbmRpZicsXHJcbiAgICAgICAgJ2VuZG1hY3JvJywgJ2VuZHNhbmRib3gnLCAnZW5kc2V0JywgJ2VuZHdpdGgnLFxyXG4gICAgICAgIC8vIGxpdGVyYWxzXHJcbiAgICAgICAgJ3RydWUnLCAnZmFsc2UnLFxyXG4gICAgXSxcclxuICAgIHRva2VuaXplcjoge1xyXG4gICAgICAgIHJvb3Q6IFtcclxuICAgICAgICAgICAgLy8gd2hpdGVzcGFjZVxyXG4gICAgICAgICAgICBbL1xccysvXSxcclxuICAgICAgICAgICAgLy8gVHdpZyBUYWcgRGVsaW1pdGVyc1xyXG4gICAgICAgICAgICBbL3sjLywgJ2NvbW1lbnQudHdpZycsICdAY29tbWVudFN0YXRlJ10sXHJcbiAgICAgICAgICAgIFsveyVbLX5dPy8sICdkZWxpbWl0ZXIudHdpZycsICdAYmxvY2tTdGF0ZSddLFxyXG4gICAgICAgICAgICBbL3t7Wy1+XT8vLCAnZGVsaW1pdGVyLnR3aWcnLCAnQHZhcmlhYmxlU3RhdGUnXSxcclxuICAgICAgICAgICAgLy8gSFRNTFxyXG4gICAgICAgICAgICBbLzwhRE9DVFlQRS8sICdtZXRhdGFnLmh0bWwnLCAnQGRvY3R5cGUnXSxcclxuICAgICAgICAgICAgWy88IS0tLywgJ2NvbW1lbnQuaHRtbCcsICdAY29tbWVudCddLFxyXG4gICAgICAgICAgICBbLyg8KSgoPzpbXFx3XFwtXSs6KT9bXFx3XFwtXSspKFxccyopKFxcLz4pLywgWydkZWxpbWl0ZXIuaHRtbCcsICd0YWcuaHRtbCcsICcnLCAnZGVsaW1pdGVyLmh0bWwnXV0sXHJcbiAgICAgICAgICAgIFsvKDwpKHNjcmlwdCkvLCBbJ2RlbGltaXRlci5odG1sJywgeyB0b2tlbjogJ3RhZy5odG1sJywgbmV4dDogJ0BzY3JpcHQnIH1dXSxcclxuICAgICAgICAgICAgWy8oPCkoc3R5bGUpLywgWydkZWxpbWl0ZXIuaHRtbCcsIHsgdG9rZW46ICd0YWcuaHRtbCcsIG5leHQ6ICdAc3R5bGUnIH1dXSxcclxuICAgICAgICAgICAgWy8oPCkoKD86W1xcd1xcLV0rOik/W1xcd1xcLV0rKS8sIFsnZGVsaW1pdGVyLmh0bWwnLCB7IHRva2VuOiAndGFnLmh0bWwnLCBuZXh0OiAnQG90aGVyVGFnJyB9XV0sXHJcbiAgICAgICAgICAgIFsvKDxcXC8pKCg/OltcXHdcXC1dKzopP1tcXHdcXC1dKykvLCBbJ2RlbGltaXRlci5odG1sJywgeyB0b2tlbjogJ3RhZy5odG1sJywgbmV4dDogJ0BvdGhlclRhZycgfV1dLFxyXG4gICAgICAgICAgICBbLzwvLCAnZGVsaW1pdGVyLmh0bWwnXSxcclxuICAgICAgICAgICAgWy9bXjxdKy9dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQ29tbWVudCBUYWcgSGFuZGxpbmdcclxuICAgICAgICAgKi9cclxuICAgICAgICBjb21tZW50U3RhdGU6IFtcclxuICAgICAgICAgICAgWy8jfS8sICdjb21tZW50LnR3aWcnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbLy4vLCAnY29tbWVudC50d2lnJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBCbG9jayBUYWcgSGFuZGxpbmdcclxuICAgICAgICAgKi9cclxuICAgICAgICBibG9ja1N0YXRlOiBbXHJcbiAgICAgICAgICAgIFsvWy1+XT8lfS8sICdkZWxpbWl0ZXIudHdpZycsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIC8vIHdoaXRlc3BhY2VcclxuICAgICAgICAgICAgWy9cXHMrL10sXHJcbiAgICAgICAgICAgIC8vIHZlcmJhdGltXHJcbiAgICAgICAgICAgIC8vIFVubGlrZSBvdGhlciBibG9ja3MsIHZlcmJhdGltIGVoYXMgaXRzIG93biBzdGF0ZVxyXG4gICAgICAgICAgICAvLyB0cmFuc2l0aW9uIHRvIGVuc3VyZSB3ZSBtYXJrIGl0cyBjb250ZW50cyBhcyBzdHJpbmdzLlxyXG4gICAgICAgICAgICBbLyh2ZXJiYXRpbSkoXFxzKikoWy1+XT8lfSkvLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgJ2tleXdvcmQudHdpZycsXHJcbiAgICAgICAgICAgICAgICAgICAgJycsXHJcbiAgICAgICAgICAgICAgICAgICAgeyB0b2tlbjogJ2RlbGltaXRlci50d2lnJywgbmV4dDogJ0ByYXdEYXRhU3RhdGUnIH0sXHJcbiAgICAgICAgICAgICAgICBdXSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnZXhwcmVzc2lvbicgfVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmF3RGF0YVN0YXRlOiBbXHJcbiAgICAgICAgICAgIC8vIGVuZHZlcmJhdGltXHJcbiAgICAgICAgICAgIFsvKHslWy1+XT8pKFxccyopKGVuZHZlcmJhdGltKShcXHMqKShbLX5dPyV9KS8sIFtcclxuICAgICAgICAgICAgICAgICAgICAnZGVsaW1pdGVyLnR3aWcnLFxyXG4gICAgICAgICAgICAgICAgICAgICcnLFxyXG4gICAgICAgICAgICAgICAgICAgICdrZXl3b3JkLnR3aWcnLFxyXG4gICAgICAgICAgICAgICAgICAgICcnLFxyXG4gICAgICAgICAgICAgICAgICAgIHsgdG9rZW46ICdkZWxpbWl0ZXIudHdpZycsIG5leHQ6ICdAcG9wYWxsJyB9LFxyXG4gICAgICAgICAgICAgICAgXV0sXHJcbiAgICAgICAgICAgIFsvLi8sICdzdHJpbmcudHdpZyddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVmFyaWFibGUgVGFnIEhhbmRsaW5nXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdmFyaWFibGVTdGF0ZTogW1xyXG4gICAgICAgICAgICBbL1stfl0/fX0vLCAnZGVsaW1pdGVyLnR3aWcnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdleHByZXNzaW9uJyB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3RyaW5nU3RhdGU6IFtcclxuICAgICAgICAgICAgLy8gY2xvc2luZyBkb3VibGUgcXVvdGVkIHN0cmluZ1xyXG4gICAgICAgICAgICBbL1wiLywgJ3N0cmluZy50d2lnJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgLy8gaW50ZXJwb2xhdGlvbiBzdGFydFxyXG4gICAgICAgICAgICBbLyN7XFxzKi8sICdzdHJpbmcudHdpZycsICdAaW50ZXJwb2xhdGlvblN0YXRlJ10sXHJcbiAgICAgICAgICAgIC8vIHN0cmluZyBwYXJ0XHJcbiAgICAgICAgICAgIFsvW14jXCJcXFxcXSooPzooPzpcXFxcLnwjKD8hXFx7KSlbXiNcIlxcXFxdKikqLywgJ3N0cmluZy50d2lnJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBpbnRlcnBvbGF0aW9uU3RhdGU6IFtcclxuICAgICAgICAgICAgLy8gaW50ZXJwb2xhdGlvbiBlbmRcclxuICAgICAgICAgICAgWy99LywgJ3N0cmluZy50d2lnJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnZXhwcmVzc2lvbicgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEV4cHJlc3Npb24gSGFuZGxpbmdcclxuICAgICAgICAgKi9cclxuICAgICAgICBleHByZXNzaW9uOiBbXHJcbiAgICAgICAgICAgIC8vIHdoaXRlc3BhY2VcclxuICAgICAgICAgICAgWy9cXHMrL10sXHJcbiAgICAgICAgICAgIC8vIG9wZXJhdG9ycyAtIG1hdGhcclxuICAgICAgICAgICAgWy9cXCt8LXxcXC97MSwyfXwlfFxcKnsxLDJ9LywgJ29wZXJhdG9ycy50d2lnJ10sXHJcbiAgICAgICAgICAgIC8vIG9wZXJhdG9ycyAtIGxvZ2ljXHJcbiAgICAgICAgICAgIFsvKGFuZHxvcnxub3R8Yi1hbmR8Yi14b3J8Yi1vcikoXFxzKykvLCBbJ29wZXJhdG9ycy50d2lnJywgJyddXSxcclxuICAgICAgICAgICAgLy8gb3BlcmF0b3JzIC0gY29tcGFyaXNvbiAoc3ltYm9scylcclxuICAgICAgICAgICAgWy89PXwhPXw8fD58Pj18PD0vLCAnb3BlcmF0b3JzLnR3aWcnXSxcclxuICAgICAgICAgICAgLy8gb3BlcmF0b3JzIC0gY29tcGFyaXNvbiAod29yZHMpXHJcbiAgICAgICAgICAgIFsvKHN0YXJ0cyB3aXRofGVuZHMgd2l0aHxtYXRjaGVzKShcXHMrKS8sIFsnb3BlcmF0b3JzLnR3aWcnLCAnJ11dLFxyXG4gICAgICAgICAgICAvLyBvcGVyYXRvcnMgLSBjb250YWlubWVudFxyXG4gICAgICAgICAgICBbLyhpbikoXFxzKykvLCBbJ29wZXJhdG9ycy50d2lnJywgJyddXSxcclxuICAgICAgICAgICAgLy8gb3BlcmF0b3JzIC0gdGVzdFxyXG4gICAgICAgICAgICBbLyhpcykoXFxzKykvLCBbJ29wZXJhdG9ycy50d2lnJywgJyddXSxcclxuICAgICAgICAgICAgLy8gb3BlcmF0b3JzIC0gbWlzY1xyXG4gICAgICAgICAgICBbL1xcfHx+fDp8XFwuezEsMn18XFw/ezEsMn0vLCAnb3BlcmF0b3JzLnR3aWcnXSxcclxuICAgICAgICAgICAgLy8gbmFtZXNcclxuICAgICAgICAgICAgWy9bXlxcV1xcZF1bXFx3XSovLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6ICdrZXl3b3JkLnR3aWcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAndmFyaWFibGUudHdpZydcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgLy8gbnVtYmVyc1xyXG4gICAgICAgICAgICBbL1xcZCsoXFwuXFxkKyk/LywgJ251bWJlci50d2lnJ10sXHJcbiAgICAgICAgICAgIC8vIHB1bmN0dWF0aW9uXHJcbiAgICAgICAgICAgIFsvXFwofFxcKXxcXFt8XFxdfHt8fXwsLywgJ2RlbGltaXRlci50d2lnJ10sXHJcbiAgICAgICAgICAgIC8vIHN0cmluZ3NcclxuICAgICAgICAgICAgWy9cIihbXiNcIlxcXFxdKig/OlxcXFwuW14jXCJcXFxcXSopKilcInxcXCcoW15cXCdcXFxcXSooPzpcXFxcLlteXFwnXFxcXF0qKSopXFwnLywgJ3N0cmluZy50d2lnJ10sXHJcbiAgICAgICAgICAgIC8vIG9wZW5pbmcgZG91YmxlIHF1b3RlZCBzdHJpbmdcclxuICAgICAgICAgICAgWy9cIi8sICdzdHJpbmcudHdpZycsICdAc3RyaW5nU3RhdGUnXSxcclxuICAgICAgICAgICAgLy8gbWlzYyBzeW50YWN0aWMgY29uc3RydWN0c1xyXG4gICAgICAgICAgICAvLyBUaGVzZSBhcmUgbm90IG9wZXJhdG9ycyBwZXIgc2UsIGJ1dCBmb3IgdGhlIHB1cnBvc2VzIG9mIGxleGljYWwgYW5hbHlzaXMgd2VcclxuICAgICAgICAgICAgLy8gY2FuIHRyZWF0IHRoZW0gYXMgc3VjaC5cclxuICAgICAgICAgICAgLy8gYXJyb3cgZnVuY3Rpb25zXHJcbiAgICAgICAgICAgIFsvPT4vLCAnb3BlcmF0b3JzLnR3aWcnXSxcclxuICAgICAgICAgICAgLy8gYXNzaWdubWVudFxyXG4gICAgICAgICAgICBbLz0vLCAnb3BlcmF0b3JzLnR3aWcnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEhUTUxcclxuICAgICAgICAgKi9cclxuICAgICAgICBkb2N0eXBlOiBbXHJcbiAgICAgICAgICAgIFsvW14+XSsvLCAnbWV0YXRhZy5jb250ZW50Lmh0bWwnXSxcclxuICAgICAgICAgICAgWy8+LywgJ21ldGF0YWcuaHRtbCcsICdAcG9wJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjb21tZW50OiBbXHJcbiAgICAgICAgICAgIFsvLS0+LywgJ2NvbW1lbnQuaHRtbCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvW14tXSsvLCAnY29tbWVudC5jb250ZW50Lmh0bWwnXSxcclxuICAgICAgICAgICAgWy8uLywgJ2NvbW1lbnQuY29udGVudC5odG1sJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIG90aGVyVGFnOiBbXHJcbiAgICAgICAgICAgIFsvXFwvPz4vLCAnZGVsaW1pdGVyLmh0bWwnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICBbL1wiKFteXCJdKilcIi8sICdhdHRyaWJ1dGUudmFsdWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbLycoW14nXSopJy8sICdhdHRyaWJ1dGUudmFsdWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbL1tcXHdcXC1dKy8sICdhdHRyaWJ1dGUubmFtZS5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvPS8sICdkZWxpbWl0ZXIuaHRtbCddLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIC0tIEJFR0lOIDxzY3JpcHQ+IHRhZ3MgaGFuZGxpbmdcclxuICAgICAgICAvLyBBZnRlciA8c2NyaXB0XHJcbiAgICAgICAgc2NyaXB0OiBbXHJcbiAgICAgICAgICAgIFsvdHlwZS8sICdhdHRyaWJ1dGUubmFtZS5odG1sJywgJ0BzY3JpcHRBZnRlclR5cGUnXSxcclxuICAgICAgICAgICAgWy9cIihbXlwiXSopXCIvLCAnYXR0cmlidXRlLnZhbHVlLmh0bWwnXSxcclxuICAgICAgICAgICAgWy8nKFteJ10qKScvLCAnYXR0cmlidXRlLnZhbHVlLmh0bWwnXSxcclxuICAgICAgICAgICAgWy9bXFx3XFwtXSsvLCAnYXR0cmlidXRlLm5hbWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbLz0vLCAnZGVsaW1pdGVyLmh0bWwnXSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzY3JpcHRFbWJlZGRlZCcsIG5leHRFbWJlZGRlZDogJ3RleHQvamF2YXNjcmlwdCcgfV0sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy9dLFxyXG4gICAgICAgICAgICBbLyg8XFwvKShzY3JpcHRcXHMqKSg+KS8sIFsnZGVsaW1pdGVyLmh0bWwnLCAndGFnLmh0bWwnLCB7IHRva2VuOiAnZGVsaW1pdGVyLmh0bWwnLCBuZXh0OiAnQHBvcCcgfV1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBBZnRlciA8c2NyaXB0IC4uLiB0eXBlXHJcbiAgICAgICAgc2NyaXB0QWZ0ZXJUeXBlOiBbXHJcbiAgICAgICAgICAgIFsvPS8sICdkZWxpbWl0ZXIuaHRtbCcsICdAc2NyaXB0QWZ0ZXJUeXBlRXF1YWxzJ10sXHJcbiAgICAgICAgICAgIFsvPi8sIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAc2NyaXB0RW1iZWRkZWQnLCBuZXh0RW1iZWRkZWQ6ICd0ZXh0L2phdmFzY3JpcHQnIH1dLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICAgICAgWy88XFwvc2NyaXB0XFxzKj4vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEFmdGVyIDxzY3JpcHQgLi4uIHR5cGUgPVxyXG4gICAgICAgIHNjcmlwdEFmdGVyVHlwZUVxdWFsczogW1xyXG4gICAgICAgICAgICBbL1wiKFteXCJdKilcIi8sIHsgdG9rZW46ICdhdHRyaWJ1dGUudmFsdWUuaHRtbCcsIHN3aXRjaFRvOiAnQHNjcmlwdFdpdGhDdXN0b21UeXBlLiQxJyB9XSxcclxuICAgICAgICAgICAgWy8nKFteJ10qKScvLCB7IHRva2VuOiAnYXR0cmlidXRlLnZhbHVlLmh0bWwnLCBzd2l0Y2hUbzogJ0BzY3JpcHRXaXRoQ3VzdG9tVHlwZS4kMScgfV0sXHJcbiAgICAgICAgICAgIFsvPi8sIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAc2NyaXB0RW1iZWRkZWQnLCBuZXh0RW1iZWRkZWQ6ICd0ZXh0L2phdmFzY3JpcHQnIH1dLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICAgICAgWy88XFwvc2NyaXB0XFxzKj4vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEFmdGVyIDxzY3JpcHQgLi4uIHR5cGUgPSAkUzJcclxuICAgICAgICBzY3JpcHRXaXRoQ3VzdG9tVHlwZTogW1xyXG4gICAgICAgICAgICBbLz4vLCB7IHRva2VuOiAnZGVsaW1pdGVyLmh0bWwnLCBuZXh0OiAnQHNjcmlwdEVtYmVkZGVkLiRTMicsIG5leHRFbWJlZGRlZDogJyRTMicgfV0sXHJcbiAgICAgICAgICAgIFsvXCIoW15cIl0qKVwiLywgJ2F0dHJpYnV0ZS52YWx1ZS5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvJyhbXiddKiknLywgJ2F0dHJpYnV0ZS52YWx1ZS5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvW1xcd1xcLV0rLywgJ2F0dHJpYnV0ZS5uYW1lLmh0bWwnXSxcclxuICAgICAgICAgICAgWy89LywgJ2RlbGltaXRlci5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy9dLFxyXG4gICAgICAgICAgICBbLzxcXC9zY3JpcHRcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc2NyaXB0RW1iZWRkZWQ6IFtcclxuICAgICAgICAgICAgWy88XFwvc2NyaXB0LywgeyB0b2tlbjogJ0ByZW1hdGNoJywgbmV4dDogJ0Bwb3AnLCBuZXh0RW1iZWRkZWQ6ICdAcG9wJyB9XSxcclxuICAgICAgICAgICAgWy9bXjxdKy8sICcnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gLS0gRU5EIDxzY3JpcHQ+IHRhZ3MgaGFuZGxpbmdcclxuICAgICAgICAvLyAtLSBCRUdJTiA8c3R5bGU+IHRhZ3MgaGFuZGxpbmdcclxuICAgICAgICAvLyBBZnRlciA8c3R5bGVcclxuICAgICAgICBzdHlsZTogW1xyXG4gICAgICAgICAgICBbL3R5cGUvLCAnYXR0cmlidXRlLm5hbWUuaHRtbCcsICdAc3R5bGVBZnRlclR5cGUnXSxcclxuICAgICAgICAgICAgWy9cIihbXlwiXSopXCIvLCAnYXR0cmlidXRlLnZhbHVlLmh0bWwnXSxcclxuICAgICAgICAgICAgWy8nKFteJ10qKScvLCAnYXR0cmlidXRlLnZhbHVlLmh0bWwnXSxcclxuICAgICAgICAgICAgWy9bXFx3XFwtXSsvLCAnYXR0cmlidXRlLm5hbWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbLz0vLCAnZGVsaW1pdGVyLmh0bWwnXSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzdHlsZUVtYmVkZGVkJywgbmV4dEVtYmVkZGVkOiAndGV4dC9jc3MnIH1dLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICAgICAgWy8oPFxcLykoc3R5bGVcXHMqKSg+KS8sIFsnZGVsaW1pdGVyLmh0bWwnLCAndGFnLmh0bWwnLCB7IHRva2VuOiAnZGVsaW1pdGVyLmh0bWwnLCBuZXh0OiAnQHBvcCcgfV1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBBZnRlciA8c3R5bGUgLi4uIHR5cGVcclxuICAgICAgICBzdHlsZUFmdGVyVHlwZTogW1xyXG4gICAgICAgICAgICBbLz0vLCAnZGVsaW1pdGVyLmh0bWwnLCAnQHN0eWxlQWZ0ZXJUeXBlRXF1YWxzJ10sXHJcbiAgICAgICAgICAgIFsvPi8sIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAc3R5bGVFbWJlZGRlZCcsIG5leHRFbWJlZGRlZDogJ3RleHQvY3NzJyB9XSxcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rL10sXHJcbiAgICAgICAgICAgIFsvPFxcL3N0eWxlXFxzKj4vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEFmdGVyIDxzdHlsZSAuLi4gdHlwZSA9XHJcbiAgICAgICAgc3R5bGVBZnRlclR5cGVFcXVhbHM6IFtcclxuICAgICAgICAgICAgWy9cIihbXlwiXSopXCIvLCB7IHRva2VuOiAnYXR0cmlidXRlLnZhbHVlLmh0bWwnLCBzd2l0Y2hUbzogJ0BzdHlsZVdpdGhDdXN0b21UeXBlLiQxJyB9XSxcclxuICAgICAgICAgICAgWy8nKFteJ10qKScvLCB7IHRva2VuOiAnYXR0cmlidXRlLnZhbHVlLmh0bWwnLCBzd2l0Y2hUbzogJ0BzdHlsZVdpdGhDdXN0b21UeXBlLiQxJyB9XSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzdHlsZUVtYmVkZGVkJywgbmV4dEVtYmVkZGVkOiAndGV4dC9jc3MnIH1dLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICAgICAgWy88XFwvc3R5bGVcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gQWZ0ZXIgPHN0eWxlIC4uLiB0eXBlID0gJFMyXHJcbiAgICAgICAgc3R5bGVXaXRoQ3VzdG9tVHlwZTogW1xyXG4gICAgICAgICAgICBbLz4vLCB7IHRva2VuOiAnZGVsaW1pdGVyLmh0bWwnLCBuZXh0OiAnQHN0eWxlRW1iZWRkZWQuJFMyJywgbmV4dEVtYmVkZGVkOiAnJFMyJyB9XSxcclxuICAgICAgICAgICAgWy9cIihbXlwiXSopXCIvLCAnYXR0cmlidXRlLnZhbHVlLmh0bWwnXSxcclxuICAgICAgICAgICAgWy8nKFteJ10qKScvLCAnYXR0cmlidXRlLnZhbHVlLmh0bWwnXSxcclxuICAgICAgICAgICAgWy9bXFx3XFwtXSsvLCAnYXR0cmlidXRlLm5hbWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbLz0vLCAnZGVsaW1pdGVyLmh0bWwnXSxcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rL10sXHJcbiAgICAgICAgICAgIFsvPFxcL3N0eWxlXFxzKj4vLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIHN0eWxlRW1iZWRkZWQ6IFtcclxuICAgICAgICAgICAgWy88XFwvc3R5bGUvLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcsIG5leHRFbWJlZGRlZDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbL1tePF0rLywgJyddXHJcbiAgICAgICAgXSxcclxuICAgIH1cclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIifQ==