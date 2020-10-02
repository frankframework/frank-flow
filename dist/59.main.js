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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3R3aWcvdHdpZy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1AsZ0VBQWdFLElBQUksTUFBTTtBQUMxRTtBQUNBLHlCQUF5QixPQUFPO0FBQ2hDLEtBQUs7QUFDTDtBQUNBLFdBQVcsT0FBTztBQUNsQixXQUFXLE9BQU87QUFDbEIsWUFBWSxNQUFNO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLGdCQUFnQixHQUFHO0FBQ3JDLFNBQVMsU0FBUyxnQkFBZ0IsR0FBRztBQUNyQyxTQUFTLFVBQVUsZUFBZSxHQUFHO0FBQ3JDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCO0FBQ25DO0FBQ0E7QUFDQSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBLFNBQVMsd0JBQXdCO0FBQ2pDO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZTtBQUNmLGVBQWU7QUFDZixnQkFBZ0I7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnREFBZ0QscUNBQXFDO0FBQ3JGLCtDQUErQyxvQ0FBb0M7QUFDbkYsOERBQThELHVDQUF1QztBQUNyRyxnRUFBZ0UsdUNBQXVDO0FBQ3ZHO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWdCO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQjtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUNBQXFDO0FBQ3JDO0FBQ0E7QUFDQSxxQkFBcUIsaURBQWlEO0FBQ3RFO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBLGdCQUFnQixzQ0FBc0M7QUFDdEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQkFBcUIsMkNBQTJDO0FBQ2hFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUJBQXFCO0FBQ3JCLGFBQWEsd0JBQXdCO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnQkFBZ0I7QUFDaEI7QUFDQSxzQ0FBc0M7QUFDdEM7QUFDQTtBQUNBO0FBQ0EsZUFBZTtBQUNmLGFBQWEsd0JBQXdCO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0IsSUFBSSxNQUFNLElBQUk7QUFDcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixJQUFJLElBQUksSUFBSTtBQUNwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0EsMkJBQTJCLEVBQUU7QUFDN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsb0ZBQW9GO0FBQ3ZHO0FBQ0Esb0VBQW9FLHdDQUF3QztBQUM1RztBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQixvRkFBb0Y7QUFDdkc7QUFDQSwrQkFBK0Isa0NBQWtDO0FBQ2pFO0FBQ0E7QUFDQTtBQUNBLDJCQUEyQixzRUFBc0U7QUFDakcsMkJBQTJCLHNFQUFzRTtBQUNqRyxtQkFBbUIsb0ZBQW9GO0FBQ3ZHO0FBQ0EsK0JBQStCLGtDQUFrQztBQUNqRTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsNEVBQTRFO0FBQy9GO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrQkFBK0Isa0NBQWtDO0FBQ2pFO0FBQ0E7QUFDQSwyQkFBMkIsd0RBQXdEO0FBQ25GO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsNEVBQTRFO0FBQy9GO0FBQ0EsbUVBQW1FLHdDQUF3QztBQUMzRztBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQiw0RUFBNEU7QUFDL0Y7QUFDQSw4QkFBOEIsa0NBQWtDO0FBQ2hFO0FBQ0E7QUFDQTtBQUNBLDJCQUEyQixxRUFBcUU7QUFDaEcsMkJBQTJCLHFFQUFxRTtBQUNoRyxtQkFBbUIsNEVBQTRFO0FBQy9GO0FBQ0EsOEJBQThCLGtDQUFrQztBQUNoRTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsMkVBQTJFO0FBQzlGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4QkFBOEIsa0NBQWtDO0FBQ2hFO0FBQ0E7QUFDQSwwQkFBMEIsd0RBQXdEO0FBQ2xGO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IjU5Lm1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5leHBvcnQgdmFyIGNvbmYgPSB7XHJcbiAgICB3b3JkUGF0dGVybjogLygtP1xcZCpcXC5cXGRcXHcqKXwoW15cXGBcXH5cXCFcXEBcXCRcXF5cXCZcXCpcXChcXClcXD1cXCtcXFtcXHtcXF1cXH1cXFxcXFx8XFw7XFw6XFwnXFxcIlxcLFxcLlxcPFxcPlxcL1xcc10rKS9nLFxyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBibG9ja0NvbW1lbnQ6IFsneyMnLCAnI30nXSxcclxuICAgIH0sXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIFsneyMnLCAnI30nXSxcclxuICAgICAgICBbJ3slJywgJyV9J10sXHJcbiAgICAgICAgWyd7eycsICd9fSddLFxyXG4gICAgICAgIFsnKCcsICcpJ10sXHJcbiAgICAgICAgWydbJywgJ10nXSxcclxuICAgICAgICAvLyBIVE1MXHJcbiAgICAgICAgWyc8IS0tJywgJy0tPiddLFxyXG4gICAgICAgIFsnPCcsICc+J10sXHJcbiAgICBdLFxyXG4gICAgYXV0b0Nsb3NpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3sjICcsIGNsb3NlOiAnICN9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3slICcsIGNsb3NlOiAnICV9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ3t7ICcsIGNsb3NlOiAnIH19JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgICAgICAvLyBIVE1MXHJcbiAgICAgICAgeyBvcGVuOiAnPCcsIGNsb3NlOiAnPicgfSxcclxuICAgIF0sXHJcbn07XHJcbmV4cG9ydCB2YXIgbGFuZ3VhZ2UgPSB7XHJcbiAgICBkZWZhdWx0VG9rZW46ICcnLFxyXG4gICAgdG9rZW5Qb3N0Zml4OiAnJyxcclxuICAgIGlnbm9yZUNhc2U6IHRydWUsXHJcbiAgICBrZXl3b3JkczogW1xyXG4gICAgICAgIC8vIChvcGVuaW5nKSB0YWdzXHJcbiAgICAgICAgJ2FwcGx5JywgJ2F1dG9lc2NhcGUnLCAnYmxvY2snLCAnZGVwcmVjYXRlZCcsICdkbycsICdlbWJlZCcsICdleHRlbmRzJyxcclxuICAgICAgICAnZmx1c2gnLCAnZm9yJywgJ2Zyb20nLCAnaWYnLCAnaW1wb3J0JywgJ2luY2x1ZGUnLCAnbWFjcm8nLCAnc2FuZGJveCcsXHJcbiAgICAgICAgJ3NldCcsICd1c2UnLCAndmVyYmF0aW0nLCAnd2l0aCcsXHJcbiAgICAgICAgLy8gY2xvc2luZyB0YWdzXHJcbiAgICAgICAgJ2VuZGFwcGx5JywgJ2VuZGF1dG9lc2NhcGUnLCAnZW5kYmxvY2snLCAnZW5kZW1iZWQnLCAnZW5kZm9yJywgJ2VuZGlmJyxcclxuICAgICAgICAnZW5kbWFjcm8nLCAnZW5kc2FuZGJveCcsICdlbmRzZXQnLCAnZW5kd2l0aCcsXHJcbiAgICAgICAgLy8gbGl0ZXJhbHNcclxuICAgICAgICAndHJ1ZScsICdmYWxzZScsXHJcbiAgICBdLFxyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICAvLyB3aGl0ZXNwYWNlXHJcbiAgICAgICAgICAgIFsvXFxzKy9dLFxyXG4gICAgICAgICAgICAvLyBUd2lnIFRhZyBEZWxpbWl0ZXJzXHJcbiAgICAgICAgICAgIFsveyMvLCAnY29tbWVudC50d2lnJywgJ0Bjb21tZW50U3RhdGUnXSxcclxuICAgICAgICAgICAgWy97JVstfl0/LywgJ2RlbGltaXRlci50d2lnJywgJ0BibG9ja1N0YXRlJ10sXHJcbiAgICAgICAgICAgIFsve3tbLX5dPy8sICdkZWxpbWl0ZXIudHdpZycsICdAdmFyaWFibGVTdGF0ZSddLFxyXG4gICAgICAgICAgICAvLyBIVE1MXHJcbiAgICAgICAgICAgIFsvPCFET0NUWVBFLywgJ21ldGF0YWcuaHRtbCcsICdAZG9jdHlwZSddLFxyXG4gICAgICAgICAgICBbLzwhLS0vLCAnY29tbWVudC5odG1sJywgJ0Bjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvKDwpKCg/OltcXHdcXC1dKzopP1tcXHdcXC1dKykoXFxzKikoXFwvPikvLCBbJ2RlbGltaXRlci5odG1sJywgJ3RhZy5odG1sJywgJycsICdkZWxpbWl0ZXIuaHRtbCddXSxcclxuICAgICAgICAgICAgWy8oPCkoc2NyaXB0KS8sIFsnZGVsaW1pdGVyLmh0bWwnLCB7IHRva2VuOiAndGFnLmh0bWwnLCBuZXh0OiAnQHNjcmlwdCcgfV1dLFxyXG4gICAgICAgICAgICBbLyg8KShzdHlsZSkvLCBbJ2RlbGltaXRlci5odG1sJywgeyB0b2tlbjogJ3RhZy5odG1sJywgbmV4dDogJ0BzdHlsZScgfV1dLFxyXG4gICAgICAgICAgICBbLyg8KSgoPzpbXFx3XFwtXSs6KT9bXFx3XFwtXSspLywgWydkZWxpbWl0ZXIuaHRtbCcsIHsgdG9rZW46ICd0YWcuaHRtbCcsIG5leHQ6ICdAb3RoZXJUYWcnIH1dXSxcclxuICAgICAgICAgICAgWy8oPFxcLykoKD86W1xcd1xcLV0rOik/W1xcd1xcLV0rKS8sIFsnZGVsaW1pdGVyLmh0bWwnLCB7IHRva2VuOiAndGFnLmh0bWwnLCBuZXh0OiAnQG90aGVyVGFnJyB9XV0sXHJcbiAgICAgICAgICAgIFsvPC8sICdkZWxpbWl0ZXIuaHRtbCddLFxyXG4gICAgICAgICAgICBbL1tePF0rL10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBDb21tZW50IFRhZyBIYW5kbGluZ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNvbW1lbnRTdGF0ZTogW1xyXG4gICAgICAgICAgICBbLyN9LywgJ2NvbW1lbnQudHdpZycsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvLi8sICdjb21tZW50LnR3aWcnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEJsb2NrIFRhZyBIYW5kbGluZ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGJsb2NrU3RhdGU6IFtcclxuICAgICAgICAgICAgWy9bLX5dPyV9LywgJ2RlbGltaXRlci50d2lnJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgLy8gd2hpdGVzcGFjZVxyXG4gICAgICAgICAgICBbL1xccysvXSxcclxuICAgICAgICAgICAgLy8gdmVyYmF0aW1cclxuICAgICAgICAgICAgLy8gVW5saWtlIG90aGVyIGJsb2NrcywgdmVyYmF0aW0gZWhhcyBpdHMgb3duIHN0YXRlXHJcbiAgICAgICAgICAgIC8vIHRyYW5zaXRpb24gdG8gZW5zdXJlIHdlIG1hcmsgaXRzIGNvbnRlbnRzIGFzIHN0cmluZ3MuXHJcbiAgICAgICAgICAgIFsvKHZlcmJhdGltKShcXHMqKShbLX5dPyV9KS8sIFtcclxuICAgICAgICAgICAgICAgICAgICAna2V5d29yZC50d2lnJyxcclxuICAgICAgICAgICAgICAgICAgICAnJyxcclxuICAgICAgICAgICAgICAgICAgICB7IHRva2VuOiAnZGVsaW1pdGVyLnR3aWcnLCBuZXh0OiAnQHJhd0RhdGFTdGF0ZScgfSxcclxuICAgICAgICAgICAgICAgIF1dLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdleHByZXNzaW9uJyB9XHJcbiAgICAgICAgXSxcclxuICAgICAgICByYXdEYXRhU3RhdGU6IFtcclxuICAgICAgICAgICAgLy8gZW5kdmVyYmF0aW1cclxuICAgICAgICAgICAgWy8oeyVbLX5dPykoXFxzKikoZW5kdmVyYmF0aW0pKFxccyopKFstfl0/JX0pLywgW1xyXG4gICAgICAgICAgICAgICAgICAgICdkZWxpbWl0ZXIudHdpZycsXHJcbiAgICAgICAgICAgICAgICAgICAgJycsXHJcbiAgICAgICAgICAgICAgICAgICAgJ2tleXdvcmQudHdpZycsXHJcbiAgICAgICAgICAgICAgICAgICAgJycsXHJcbiAgICAgICAgICAgICAgICAgICAgeyB0b2tlbjogJ2RlbGltaXRlci50d2lnJywgbmV4dDogJ0Bwb3BhbGwnIH0sXHJcbiAgICAgICAgICAgICAgICBdXSxcclxuICAgICAgICAgICAgWy8uLywgJ3N0cmluZy50d2lnJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBWYXJpYWJsZSBUYWcgSGFuZGxpbmdcclxuICAgICAgICAgKi9cclxuICAgICAgICB2YXJpYWJsZVN0YXRlOiBbXHJcbiAgICAgICAgICAgIFsvWy1+XT99fS8sICdkZWxpbWl0ZXIudHdpZycsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ2V4cHJlc3Npb24nIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzdHJpbmdTdGF0ZTogW1xyXG4gICAgICAgICAgICAvLyBjbG9zaW5nIGRvdWJsZSBxdW90ZWQgc3RyaW5nXHJcbiAgICAgICAgICAgIFsvXCIvLCAnc3RyaW5nLnR3aWcnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICAvLyBpbnRlcnBvbGF0aW9uIHN0YXJ0XHJcbiAgICAgICAgICAgIFsvI3tcXHMqLywgJ3N0cmluZy50d2lnJywgJ0BpbnRlcnBvbGF0aW9uU3RhdGUnXSxcclxuICAgICAgICAgICAgLy8gc3RyaW5nIHBhcnRcclxuICAgICAgICAgICAgWy9bXiNcIlxcXFxdKig/Oig/OlxcXFwufCMoPyFcXHspKVteI1wiXFxcXF0qKSovLCAnc3RyaW5nLnR3aWcnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGludGVycG9sYXRpb25TdGF0ZTogW1xyXG4gICAgICAgICAgICAvLyBpbnRlcnBvbGF0aW9uIGVuZFxyXG4gICAgICAgICAgICBbL30vLCAnc3RyaW5nLnR3aWcnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdleHByZXNzaW9uJyB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRXhwcmVzc2lvbiBIYW5kbGluZ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGV4cHJlc3Npb246IFtcclxuICAgICAgICAgICAgLy8gd2hpdGVzcGFjZVxyXG4gICAgICAgICAgICBbL1xccysvXSxcclxuICAgICAgICAgICAgLy8gb3BlcmF0b3JzIC0gbWF0aFxyXG4gICAgICAgICAgICBbL1xcK3wtfFxcL3sxLDJ9fCV8XFwqezEsMn0vLCAnb3BlcmF0b3JzLnR3aWcnXSxcclxuICAgICAgICAgICAgLy8gb3BlcmF0b3JzIC0gbG9naWNcclxuICAgICAgICAgICAgWy8oYW5kfG9yfG5vdHxiLWFuZHxiLXhvcnxiLW9yKShcXHMrKS8sIFsnb3BlcmF0b3JzLnR3aWcnLCAnJ11dLFxyXG4gICAgICAgICAgICAvLyBvcGVyYXRvcnMgLSBjb21wYXJpc29uIChzeW1ib2xzKVxyXG4gICAgICAgICAgICBbLz09fCE9fDx8Pnw+PXw8PS8sICdvcGVyYXRvcnMudHdpZyddLFxyXG4gICAgICAgICAgICAvLyBvcGVyYXRvcnMgLSBjb21wYXJpc29uICh3b3JkcylcclxuICAgICAgICAgICAgWy8oc3RhcnRzIHdpdGh8ZW5kcyB3aXRofG1hdGNoZXMpKFxccyspLywgWydvcGVyYXRvcnMudHdpZycsICcnXV0sXHJcbiAgICAgICAgICAgIC8vIG9wZXJhdG9ycyAtIGNvbnRhaW5tZW50XHJcbiAgICAgICAgICAgIFsvKGluKShcXHMrKS8sIFsnb3BlcmF0b3JzLnR3aWcnLCAnJ11dLFxyXG4gICAgICAgICAgICAvLyBvcGVyYXRvcnMgLSB0ZXN0XHJcbiAgICAgICAgICAgIFsvKGlzKShcXHMrKS8sIFsnb3BlcmF0b3JzLnR3aWcnLCAnJ11dLFxyXG4gICAgICAgICAgICAvLyBvcGVyYXRvcnMgLSBtaXNjXHJcbiAgICAgICAgICAgIFsvXFx8fH58OnxcXC57MSwyfXxcXD97MSwyfS8sICdvcGVyYXRvcnMudHdpZyddLFxyXG4gICAgICAgICAgICAvLyBuYW1lc1xyXG4gICAgICAgICAgICBbL1teXFxXXFxkXVtcXHddKi8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogJ2tleXdvcmQudHdpZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICd2YXJpYWJsZS50d2lnJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgICAgICAvLyBudW1iZXJzXHJcbiAgICAgICAgICAgIFsvXFxkKyhcXC5cXGQrKT8vLCAnbnVtYmVyLnR3aWcnXSxcclxuICAgICAgICAgICAgLy8gcHVuY3R1YXRpb25cclxuICAgICAgICAgICAgWy9cXCh8XFwpfFxcW3xcXF18e3x9fCwvLCAnZGVsaW1pdGVyLnR3aWcnXSxcclxuICAgICAgICAgICAgLy8gc3RyaW5nc1xyXG4gICAgICAgICAgICBbL1wiKFteI1wiXFxcXF0qKD86XFxcXC5bXiNcIlxcXFxdKikqKVwifFxcJyhbXlxcJ1xcXFxdKig/OlxcXFwuW15cXCdcXFxcXSopKilcXCcvLCAnc3RyaW5nLnR3aWcnXSxcclxuICAgICAgICAgICAgLy8gb3BlbmluZyBkb3VibGUgcXVvdGVkIHN0cmluZ1xyXG4gICAgICAgICAgICBbL1wiLywgJ3N0cmluZy50d2lnJywgJ0BzdHJpbmdTdGF0ZSddLFxyXG4gICAgICAgICAgICAvLyBtaXNjIHN5bnRhY3RpYyBjb25zdHJ1Y3RzXHJcbiAgICAgICAgICAgIC8vIFRoZXNlIGFyZSBub3Qgb3BlcmF0b3JzIHBlciBzZSwgYnV0IGZvciB0aGUgcHVycG9zZXMgb2YgbGV4aWNhbCBhbmFseXNpcyB3ZVxyXG4gICAgICAgICAgICAvLyBjYW4gdHJlYXQgdGhlbSBhcyBzdWNoLlxyXG4gICAgICAgICAgICAvLyBhcnJvdyBmdW5jdGlvbnNcclxuICAgICAgICAgICAgWy89Pi8sICdvcGVyYXRvcnMudHdpZyddLFxyXG4gICAgICAgICAgICAvLyBhc3NpZ25tZW50XHJcbiAgICAgICAgICAgIFsvPS8sICdvcGVyYXRvcnMudHdpZyddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogSFRNTFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGRvY3R5cGU6IFtcclxuICAgICAgICAgICAgWy9bXj5dKy8sICdtZXRhdGFnLmNvbnRlbnQuaHRtbCddLFxyXG4gICAgICAgICAgICBbLz4vLCAnbWV0YXRhZy5odG1sJywgJ0Bwb3AnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGNvbW1lbnQ6IFtcclxuICAgICAgICAgICAgWy8tLT4vLCAnY29tbWVudC5odG1sJywgJ0Bwb3AnXSxcclxuICAgICAgICAgICAgWy9bXi1dKy8sICdjb21tZW50LmNvbnRlbnQuaHRtbCddLFxyXG4gICAgICAgICAgICBbLy4vLCAnY29tbWVudC5jb250ZW50Lmh0bWwnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgb3RoZXJUYWc6IFtcclxuICAgICAgICAgICAgWy9cXC8/Pi8sICdkZWxpbWl0ZXIuaHRtbCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvXCIoW15cIl0qKVwiLywgJ2F0dHJpYnV0ZS52YWx1ZS5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvJyhbXiddKiknLywgJ2F0dHJpYnV0ZS52YWx1ZS5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvW1xcd1xcLV0rLywgJ2F0dHJpYnV0ZS5uYW1lLmh0bWwnXSxcclxuICAgICAgICAgICAgWy89LywgJ2RlbGltaXRlci5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy9dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gLS0gQkVHSU4gPHNjcmlwdD4gdGFncyBoYW5kbGluZ1xyXG4gICAgICAgIC8vIEFmdGVyIDxzY3JpcHRcclxuICAgICAgICBzY3JpcHQ6IFtcclxuICAgICAgICAgICAgWy90eXBlLywgJ2F0dHJpYnV0ZS5uYW1lLmh0bWwnLCAnQHNjcmlwdEFmdGVyVHlwZSddLFxyXG4gICAgICAgICAgICBbL1wiKFteXCJdKilcIi8sICdhdHRyaWJ1dGUudmFsdWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbLycoW14nXSopJy8sICdhdHRyaWJ1dGUudmFsdWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbL1tcXHdcXC1dKy8sICdhdHRyaWJ1dGUubmFtZS5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvPS8sICdkZWxpbWl0ZXIuaHRtbCddLFxyXG4gICAgICAgICAgICBbLz4vLCB7IHRva2VuOiAnZGVsaW1pdGVyLmh0bWwnLCBuZXh0OiAnQHNjcmlwdEVtYmVkZGVkJywgbmV4dEVtYmVkZGVkOiAndGV4dC9qYXZhc2NyaXB0JyB9XSxcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rL10sXHJcbiAgICAgICAgICAgIFsvKDxcXC8pKHNjcmlwdFxccyopKD4pLywgWydkZWxpbWl0ZXIuaHRtbCcsICd0YWcuaHRtbCcsIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAcG9wJyB9XV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEFmdGVyIDxzY3JpcHQgLi4uIHR5cGVcclxuICAgICAgICBzY3JpcHRBZnRlclR5cGU6IFtcclxuICAgICAgICAgICAgWy89LywgJ2RlbGltaXRlci5odG1sJywgJ0BzY3JpcHRBZnRlclR5cGVFcXVhbHMnXSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzY3JpcHRFbWJlZGRlZCcsIG5leHRFbWJlZGRlZDogJ3RleHQvamF2YXNjcmlwdCcgfV0sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy9dLFxyXG4gICAgICAgICAgICBbLzxcXC9zY3JpcHRcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gQWZ0ZXIgPHNjcmlwdCAuLi4gdHlwZSA9XHJcbiAgICAgICAgc2NyaXB0QWZ0ZXJUeXBlRXF1YWxzOiBbXHJcbiAgICAgICAgICAgIFsvXCIoW15cIl0qKVwiLywgeyB0b2tlbjogJ2F0dHJpYnV0ZS52YWx1ZS5odG1sJywgc3dpdGNoVG86ICdAc2NyaXB0V2l0aEN1c3RvbVR5cGUuJDEnIH1dLFxyXG4gICAgICAgICAgICBbLycoW14nXSopJy8sIHsgdG9rZW46ICdhdHRyaWJ1dGUudmFsdWUuaHRtbCcsIHN3aXRjaFRvOiAnQHNjcmlwdFdpdGhDdXN0b21UeXBlLiQxJyB9XSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzY3JpcHRFbWJlZGRlZCcsIG5leHRFbWJlZGRlZDogJ3RleHQvamF2YXNjcmlwdCcgfV0sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy9dLFxyXG4gICAgICAgICAgICBbLzxcXC9zY3JpcHRcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gQWZ0ZXIgPHNjcmlwdCAuLi4gdHlwZSA9ICRTMlxyXG4gICAgICAgIHNjcmlwdFdpdGhDdXN0b21UeXBlOiBbXHJcbiAgICAgICAgICAgIFsvPi8sIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAc2NyaXB0RW1iZWRkZWQuJFMyJywgbmV4dEVtYmVkZGVkOiAnJFMyJyB9XSxcclxuICAgICAgICAgICAgWy9cIihbXlwiXSopXCIvLCAnYXR0cmlidXRlLnZhbHVlLmh0bWwnXSxcclxuICAgICAgICAgICAgWy8nKFteJ10qKScvLCAnYXR0cmlidXRlLnZhbHVlLmh0bWwnXSxcclxuICAgICAgICAgICAgWy9bXFx3XFwtXSsvLCAnYXR0cmlidXRlLm5hbWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbLz0vLCAnZGVsaW1pdGVyLmh0bWwnXSxcclxuICAgICAgICAgICAgWy9bIFxcdFxcclxcbl0rL10sXHJcbiAgICAgICAgICAgIFsvPFxcL3NjcmlwdFxccyo+LywgeyB0b2tlbjogJ0ByZW1hdGNoJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzY3JpcHRFbWJlZGRlZDogW1xyXG4gICAgICAgICAgICBbLzxcXC9zY3JpcHQvLCB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcCcsIG5leHRFbWJlZGRlZDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgICAgICBbL1tePF0rLywgJyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyAtLSBFTkQgPHNjcmlwdD4gdGFncyBoYW5kbGluZ1xyXG4gICAgICAgIC8vIC0tIEJFR0lOIDxzdHlsZT4gdGFncyBoYW5kbGluZ1xyXG4gICAgICAgIC8vIEFmdGVyIDxzdHlsZVxyXG4gICAgICAgIHN0eWxlOiBbXHJcbiAgICAgICAgICAgIFsvdHlwZS8sICdhdHRyaWJ1dGUubmFtZS5odG1sJywgJ0BzdHlsZUFmdGVyVHlwZSddLFxyXG4gICAgICAgICAgICBbL1wiKFteXCJdKilcIi8sICdhdHRyaWJ1dGUudmFsdWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbLycoW14nXSopJy8sICdhdHRyaWJ1dGUudmFsdWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbL1tcXHdcXC1dKy8sICdhdHRyaWJ1dGUubmFtZS5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvPS8sICdkZWxpbWl0ZXIuaHRtbCddLFxyXG4gICAgICAgICAgICBbLz4vLCB7IHRva2VuOiAnZGVsaW1pdGVyLmh0bWwnLCBuZXh0OiAnQHN0eWxlRW1iZWRkZWQnLCBuZXh0RW1iZWRkZWQ6ICd0ZXh0L2NzcycgfV0sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy9dLFxyXG4gICAgICAgICAgICBbLyg8XFwvKShzdHlsZVxccyopKD4pLywgWydkZWxpbWl0ZXIuaHRtbCcsICd0YWcuaHRtbCcsIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAcG9wJyB9XV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEFmdGVyIDxzdHlsZSAuLi4gdHlwZVxyXG4gICAgICAgIHN0eWxlQWZ0ZXJUeXBlOiBbXHJcbiAgICAgICAgICAgIFsvPS8sICdkZWxpbWl0ZXIuaHRtbCcsICdAc3R5bGVBZnRlclR5cGVFcXVhbHMnXSxcclxuICAgICAgICAgICAgWy8+LywgeyB0b2tlbjogJ2RlbGltaXRlci5odG1sJywgbmV4dDogJ0BzdHlsZUVtYmVkZGVkJywgbmV4dEVtYmVkZGVkOiAndGV4dC9jc3MnIH1dLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICAgICAgWy88XFwvc3R5bGVcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gQWZ0ZXIgPHN0eWxlIC4uLiB0eXBlID1cclxuICAgICAgICBzdHlsZUFmdGVyVHlwZUVxdWFsczogW1xyXG4gICAgICAgICAgICBbL1wiKFteXCJdKilcIi8sIHsgdG9rZW46ICdhdHRyaWJ1dGUudmFsdWUuaHRtbCcsIHN3aXRjaFRvOiAnQHN0eWxlV2l0aEN1c3RvbVR5cGUuJDEnIH1dLFxyXG4gICAgICAgICAgICBbLycoW14nXSopJy8sIHsgdG9rZW46ICdhdHRyaWJ1dGUudmFsdWUuaHRtbCcsIHN3aXRjaFRvOiAnQHN0eWxlV2l0aEN1c3RvbVR5cGUuJDEnIH1dLFxyXG4gICAgICAgICAgICBbLz4vLCB7IHRva2VuOiAnZGVsaW1pdGVyLmh0bWwnLCBuZXh0OiAnQHN0eWxlRW1iZWRkZWQnLCBuZXh0RW1iZWRkZWQ6ICd0ZXh0L2NzcycgfV0sXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy9dLFxyXG4gICAgICAgICAgICBbLzxcXC9zdHlsZVxccyo+LywgeyB0b2tlbjogJ0ByZW1hdGNoJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBBZnRlciA8c3R5bGUgLi4uIHR5cGUgPSAkUzJcclxuICAgICAgICBzdHlsZVdpdGhDdXN0b21UeXBlOiBbXHJcbiAgICAgICAgICAgIFsvPi8sIHsgdG9rZW46ICdkZWxpbWl0ZXIuaHRtbCcsIG5leHQ6ICdAc3R5bGVFbWJlZGRlZC4kUzInLCBuZXh0RW1iZWRkZWQ6ICckUzInIH1dLFxyXG4gICAgICAgICAgICBbL1wiKFteXCJdKilcIi8sICdhdHRyaWJ1dGUudmFsdWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbLycoW14nXSopJy8sICdhdHRyaWJ1dGUudmFsdWUuaHRtbCddLFxyXG4gICAgICAgICAgICBbL1tcXHdcXC1dKy8sICdhdHRyaWJ1dGUubmFtZS5odG1sJ10sXHJcbiAgICAgICAgICAgIFsvPS8sICdkZWxpbWl0ZXIuaHRtbCddLFxyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvXSxcclxuICAgICAgICAgICAgWy88XFwvc3R5bGVcXHMqPi8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3R5bGVFbWJlZGRlZDogW1xyXG4gICAgICAgICAgICBbLzxcXC9zdHlsZS8sIHsgdG9rZW46ICdAcmVtYXRjaCcsIG5leHQ6ICdAcG9wJywgbmV4dEVtYmVkZGVkOiAnQHBvcCcgfV0sXHJcbiAgICAgICAgICAgIFsvW148XSsvLCAnJ11cclxuICAgICAgICBdLFxyXG4gICAgfVxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9