(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[63],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/yaml/yaml.js":
/*!************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/yaml/yaml.js ***!
  \************************************************************************/
/*! exports provided: conf, language */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "conf", function() { return conf; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "language", function() { return language; });
var conf = {
    comments: {
        lineComment: '#'
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
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
    ],
    folding: {
        offSide: true
    }
};
var language = {
    tokenPostfix: '.yaml',
    brackets: [
        { token: 'delimiter.bracket', open: '{', close: '}' },
        { token: 'delimiter.square', open: '[', close: ']' }
    ],
    keywords: ['true', 'True', 'TRUE', 'false', 'False', 'FALSE', 'null', 'Null', 'Null', '~'],
    numberInteger: /(?:0|[+-]?[0-9]+)/,
    numberFloat: /(?:0|[+-]?[0-9]+)(?:\.[0-9]+)?(?:e[-+][1-9][0-9]*)?/,
    numberOctal: /0o[0-7]+/,
    numberHex: /0x[0-9a-fA-F]+/,
    numberInfinity: /[+-]?\.(?:inf|Inf|INF)/,
    numberNaN: /\.(?:nan|Nan|NAN)/,
    numberDate: /\d{4}-\d\d-\d\d([Tt ]\d\d:\d\d:\d\d(\.\d+)?(( ?[+-]\d\d?(:\d\d)?)|Z)?)?/,
    escapes: /\\(?:[btnfr\\"']|[0-7][0-7]?|[0-3][0-7]{2})/,
    tokenizer: {
        root: [
            { include: '@whitespace' },
            { include: '@comment' },
            // Directive
            [/%[^ ]+.*$/, 'meta.directive'],
            // Document Markers
            [/---/, 'operators.directivesEnd'],
            [/\.{3}/, 'operators.documentEnd'],
            // Block Structure Indicators
            [/[-?:](?= )/, 'operators'],
            { include: '@anchor' },
            { include: '@tagHandle' },
            { include: '@flowCollections' },
            { include: '@blockStyle' },
            // Numbers
            [/@numberInteger(?![ \t]*\S+)/, 'number'],
            [/@numberFloat(?![ \t]*\S+)/, 'number.float'],
            [/@numberOctal(?![ \t]*\S+)/, 'number.octal'],
            [/@numberHex(?![ \t]*\S+)/, 'number.hex'],
            [/@numberInfinity(?![ \t]*\S+)/, 'number.infinity'],
            [/@numberNaN(?![ \t]*\S+)/, 'number.nan'],
            [/@numberDate(?![ \t]*\S+)/, 'number.date'],
            // Key:Value pair
            [/(".*?"|'.*?'|.*?)([ \t]*)(:)( |$)/, ['type', 'white', 'operators', 'white']],
            { include: '@flowScalars' },
            // String nodes
            [/.+$/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@default': 'string'
                    }
                }]
        ],
        // Flow Collection: Flow Mapping
        object: [
            { include: '@whitespace' },
            { include: '@comment' },
            // Flow Mapping termination
            [/\}/, '@brackets', '@pop'],
            // Flow Mapping delimiter
            [/,/, 'delimiter.comma'],
            // Flow Mapping Key:Value delimiter
            [/:(?= )/, 'operators'],
            // Flow Mapping Key:Value key
            [/(?:".*?"|'.*?'|[^,\{\[]+?)(?=: )/, 'type'],
            // Start Flow Style
            { include: '@flowCollections' },
            { include: '@flowScalars' },
            // Scalar Data types
            { include: '@tagHandle' },
            { include: '@anchor' },
            { include: '@flowNumber' },
            // Other value (keyword or string)
            [/[^\},]+/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@default': 'string'
                    }
                }]
        ],
        // Flow Collection: Flow Sequence
        array: [
            { include: '@whitespace' },
            { include: '@comment' },
            // Flow Sequence termination
            [/\]/, '@brackets', '@pop'],
            // Flow Sequence delimiter
            [/,/, 'delimiter.comma'],
            // Start Flow Style
            { include: '@flowCollections' },
            { include: '@flowScalars' },
            // Scalar Data types
            { include: '@tagHandle' },
            { include: '@anchor' },
            { include: '@flowNumber' },
            // Other value (keyword or string)
            [/[^\],]+/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@default': 'string'
                    }
                }]
        ],
        // First line of a Block Style
        multiString: [
            [/^( +).+$/, 'string', '@multiStringContinued.$1']
        ],
        // Further lines of a Block Style
        //   Workaround for indentation detection
        multiStringContinued: [
            [/^( *).+$/, {
                    cases: {
                        '$1==$S2': 'string',
                        '@default': { token: '@rematch', next: '@popall' }
                    }
                }]
        ],
        whitespace: [
            [/[ \t\r\n]+/, 'white']
        ],
        // Only line comments
        comment: [
            [/#.*$/, 'comment']
        ],
        // Start Flow Collections
        flowCollections: [
            [/\[/, '@brackets', '@array'],
            [/\{/, '@brackets', '@object']
        ],
        // Start Flow Scalars (quoted strings)
        flowScalars: [
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/'[^']*'/, 'string'],
            [/"/, 'string', '@doubleQuotedString']
        ],
        doubleQuotedString: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, 'string', '@pop']
        ],
        // Start Block Scalar
        blockStyle: [
            [/[>|][0-9]*[+-]?$/, 'operators', '@multiString']
        ],
        // Numbers in Flow Collections (terminate with ,]})
        flowNumber: [
            [/@numberInteger(?=[ \t]*[,\]\}])/, 'number'],
            [/@numberFloat(?=[ \t]*[,\]\}])/, 'number.float'],
            [/@numberOctal(?=[ \t]*[,\]\}])/, 'number.octal'],
            [/@numberHex(?=[ \t]*[,\]\}])/, 'number.hex'],
            [/@numberInfinity(?=[ \t]*[,\]\}])/, 'number.infinity'],
            [/@numberNaN(?=[ \t]*[,\]\}])/, 'number.nan'],
            [/@numberDate(?=[ \t]*[,\]\}])/, 'number.date']
        ],
        tagHandle: [
            [/\![^ ]*/, 'tag']
        ],
        anchor: [
            [/[&*][^ ]+/, 'namespace']
        ]
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3lhbWwveWFtbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQU87QUFDUDtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsV0FBVyxLQUFLO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0EsU0FBUyxxQ0FBcUMsWUFBWSxHQUFHO0FBQzdELFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0JBQW9CLEVBQUU7QUFDdEIsc0RBQXNELEVBQUU7QUFDeEQ7QUFDQTtBQUNBLGFBQWEseUJBQXlCO0FBQ3RDLGFBQWEsc0JBQXNCO0FBQ25DO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCLEVBQUU7QUFDbkI7QUFDQTtBQUNBLGFBQWEscUJBQXFCO0FBQ2xDLGFBQWEsd0JBQXdCO0FBQ3JDLGFBQWEsOEJBQThCO0FBQzNDLGFBQWEseUJBQXlCO0FBQ3RDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBYSwwQkFBMEI7QUFDdkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBLGFBQWEseUJBQXlCO0FBQ3RDLGFBQWEsc0JBQXNCO0FBQ25DO0FBQ0EsZ0JBQWdCO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQ0FBa0M7QUFDbEM7QUFDQSxhQUFhLDhCQUE4QjtBQUMzQyxhQUFhLDBCQUEwQjtBQUN2QztBQUNBLGFBQWEsd0JBQXdCO0FBQ3JDLGFBQWEscUJBQXFCO0FBQ2xDLGFBQWEseUJBQXlCO0FBQ3RDO0FBQ0Esa0JBQWtCO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBLGFBQWEseUJBQXlCO0FBQ3RDLGFBQWEsc0JBQXNCO0FBQ25DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhLDhCQUE4QjtBQUMzQyxhQUFhLDBCQUEwQjtBQUN2QztBQUNBLGFBQWEsd0JBQXdCO0FBQ3JDLGFBQWEscUJBQXFCO0FBQ2xDLGFBQWEseUJBQXlCO0FBQ3RDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUNBQXFDO0FBQ3JDO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnQkFBZ0I7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMERBQTBEO0FBQzFEO0FBQ0EsMkNBQTJDO0FBQzNDLHlDQUF5QztBQUN6Qyx5Q0FBeUM7QUFDekMsdUNBQXVDO0FBQ3ZDLDRDQUE0QztBQUM1Qyx1Q0FBdUM7QUFDdkMsd0NBQXdDO0FBQ3hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiI2My5tYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBsaW5lQ29tbWVudDogJyMnXHJcbiAgICB9LFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICBbJ3snLCAnfSddLFxyXG4gICAgICAgIFsnWycsICddJ10sXHJcbiAgICAgICAgWycoJywgJyknXVxyXG4gICAgXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgIF0sXHJcbiAgICBmb2xkaW5nOiB7XHJcbiAgICAgICAgb2ZmU2lkZTogdHJ1ZVxyXG4gICAgfVxyXG59O1xyXG5leHBvcnQgdmFyIGxhbmd1YWdlID0ge1xyXG4gICAgdG9rZW5Qb3N0Zml4OiAnLnlhbWwnLFxyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICB7IHRva2VuOiAnZGVsaW1pdGVyLmJyYWNrZXQnLCBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IHRva2VuOiAnZGVsaW1pdGVyLnNxdWFyZScsIG9wZW46ICdbJywgY2xvc2U6ICddJyB9XHJcbiAgICBdLFxyXG4gICAga2V5d29yZHM6IFsndHJ1ZScsICdUcnVlJywgJ1RSVUUnLCAnZmFsc2UnLCAnRmFsc2UnLCAnRkFMU0UnLCAnbnVsbCcsICdOdWxsJywgJ051bGwnLCAnfiddLFxyXG4gICAgbnVtYmVySW50ZWdlcjogLyg/OjB8WystXT9bMC05XSspLyxcclxuICAgIG51bWJlckZsb2F0OiAvKD86MHxbKy1dP1swLTldKykoPzpcXC5bMC05XSspPyg/OmVbLStdWzEtOV1bMC05XSopPy8sXHJcbiAgICBudW1iZXJPY3RhbDogLzBvWzAtN10rLyxcclxuICAgIG51bWJlckhleDogLzB4WzAtOWEtZkEtRl0rLyxcclxuICAgIG51bWJlckluZmluaXR5OiAvWystXT9cXC4oPzppbmZ8SW5mfElORikvLFxyXG4gICAgbnVtYmVyTmFOOiAvXFwuKD86bmFufE5hbnxOQU4pLyxcclxuICAgIG51bWJlckRhdGU6IC9cXGR7NH0tXFxkXFxkLVxcZFxcZChbVHQgXVxcZFxcZDpcXGRcXGQ6XFxkXFxkKFxcLlxcZCspPygoID9bKy1dXFxkXFxkPyg6XFxkXFxkKT8pfFopPyk/LyxcclxuICAgIGVzY2FwZXM6IC9cXFxcKD86W2J0bmZyXFxcXFwiJ118WzAtN11bMC03XT98WzAtM11bMC03XXsyfSkvLFxyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGNvbW1lbnQnIH0sXHJcbiAgICAgICAgICAgIC8vIERpcmVjdGl2ZVxyXG4gICAgICAgICAgICBbLyVbXiBdKy4qJC8sICdtZXRhLmRpcmVjdGl2ZSddLFxyXG4gICAgICAgICAgICAvLyBEb2N1bWVudCBNYXJrZXJzXHJcbiAgICAgICAgICAgIFsvLS0tLywgJ29wZXJhdG9ycy5kaXJlY3RpdmVzRW5kJ10sXHJcbiAgICAgICAgICAgIFsvXFwuezN9LywgJ29wZXJhdG9ycy5kb2N1bWVudEVuZCddLFxyXG4gICAgICAgICAgICAvLyBCbG9jayBTdHJ1Y3R1cmUgSW5kaWNhdG9yc1xyXG4gICAgICAgICAgICBbL1stPzpdKD89ICkvLCAnb3BlcmF0b3JzJ10sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BhbmNob3InIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B0YWdIYW5kbGUnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BmbG93Q29sbGVjdGlvbnMnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BibG9ja1N0eWxlJyB9LFxyXG4gICAgICAgICAgICAvLyBOdW1iZXJzXHJcbiAgICAgICAgICAgIFsvQG51bWJlckludGVnZXIoPyFbIFxcdF0qXFxTKykvLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIFsvQG51bWJlckZsb2F0KD8hWyBcXHRdKlxcUyspLywgJ251bWJlci5mbG9hdCddLFxyXG4gICAgICAgICAgICBbL0BudW1iZXJPY3RhbCg/IVsgXFx0XSpcXFMrKS8sICdudW1iZXIub2N0YWwnXSxcclxuICAgICAgICAgICAgWy9AbnVtYmVySGV4KD8hWyBcXHRdKlxcUyspLywgJ251bWJlci5oZXgnXSxcclxuICAgICAgICAgICAgWy9AbnVtYmVySW5maW5pdHkoPyFbIFxcdF0qXFxTKykvLCAnbnVtYmVyLmluZmluaXR5J10sXHJcbiAgICAgICAgICAgIFsvQG51bWJlck5hTig/IVsgXFx0XSpcXFMrKS8sICdudW1iZXIubmFuJ10sXHJcbiAgICAgICAgICAgIFsvQG51bWJlckRhdGUoPyFbIFxcdF0qXFxTKykvLCAnbnVtYmVyLmRhdGUnXSxcclxuICAgICAgICAgICAgLy8gS2V5OlZhbHVlIHBhaXJcclxuICAgICAgICAgICAgWy8oXCIuKj9cInwnLio/J3wuKj8pKFsgXFx0XSopKDopKCB8JCkvLCBbJ3R5cGUnLCAnd2hpdGUnLCAnb3BlcmF0b3JzJywgJ3doaXRlJ11dLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAZmxvd1NjYWxhcnMnIH0sXHJcbiAgICAgICAgICAgIC8vIFN0cmluZyBub2Rlc1xyXG4gICAgICAgICAgICBbLy4rJC8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogJ2tleXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnc3RyaW5nJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBGbG93IENvbGxlY3Rpb246IEZsb3cgTWFwcGluZ1xyXG4gICAgICAgIG9iamVjdDogW1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGNvbW1lbnQnIH0sXHJcbiAgICAgICAgICAgIC8vIEZsb3cgTWFwcGluZyB0ZXJtaW5hdGlvblxyXG4gICAgICAgICAgICBbL1xcfS8sICdAYnJhY2tldHMnLCAnQHBvcCddLFxyXG4gICAgICAgICAgICAvLyBGbG93IE1hcHBpbmcgZGVsaW1pdGVyXHJcbiAgICAgICAgICAgIFsvLC8sICdkZWxpbWl0ZXIuY29tbWEnXSxcclxuICAgICAgICAgICAgLy8gRmxvdyBNYXBwaW5nIEtleTpWYWx1ZSBkZWxpbWl0ZXJcclxuICAgICAgICAgICAgWy86KD89ICkvLCAnb3BlcmF0b3JzJ10sXHJcbiAgICAgICAgICAgIC8vIEZsb3cgTWFwcGluZyBLZXk6VmFsdWUga2V5XHJcbiAgICAgICAgICAgIFsvKD86XCIuKj9cInwnLio/J3xbXixcXHtcXFtdKz8pKD89OiApLywgJ3R5cGUnXSxcclxuICAgICAgICAgICAgLy8gU3RhcnQgRmxvdyBTdHlsZVxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAZmxvd0NvbGxlY3Rpb25zJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAZmxvd1NjYWxhcnMnIH0sXHJcbiAgICAgICAgICAgIC8vIFNjYWxhciBEYXRhIHR5cGVzXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B0YWdIYW5kbGUnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BhbmNob3InIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BmbG93TnVtYmVyJyB9LFxyXG4gICAgICAgICAgICAvLyBPdGhlciB2YWx1ZSAoa2V5d29yZCBvciBzdHJpbmcpXHJcbiAgICAgICAgICAgIFsvW15cXH0sXSsvLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ3N0cmluZydcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gRmxvdyBDb2xsZWN0aW9uOiBGbG93IFNlcXVlbmNlXHJcbiAgICAgICAgYXJyYXk6IFtcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHdoaXRlc3BhY2UnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0Bjb21tZW50JyB9LFxyXG4gICAgICAgICAgICAvLyBGbG93IFNlcXVlbmNlIHRlcm1pbmF0aW9uXHJcbiAgICAgICAgICAgIFsvXFxdLywgJ0BicmFja2V0cycsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIC8vIEZsb3cgU2VxdWVuY2UgZGVsaW1pdGVyXHJcbiAgICAgICAgICAgIFsvLC8sICdkZWxpbWl0ZXIuY29tbWEnXSxcclxuICAgICAgICAgICAgLy8gU3RhcnQgRmxvdyBTdHlsZVxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAZmxvd0NvbGxlY3Rpb25zJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAZmxvd1NjYWxhcnMnIH0sXHJcbiAgICAgICAgICAgIC8vIFNjYWxhciBEYXRhIHR5cGVzXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B0YWdIYW5kbGUnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BhbmNob3InIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BmbG93TnVtYmVyJyB9LFxyXG4gICAgICAgICAgICAvLyBPdGhlciB2YWx1ZSAoa2V5d29yZCBvciBzdHJpbmcpXHJcbiAgICAgICAgICAgIFsvW15cXF0sXSsvLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ3N0cmluZydcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gRmlyc3QgbGluZSBvZiBhIEJsb2NrIFN0eWxlXHJcbiAgICAgICAgbXVsdGlTdHJpbmc6IFtcclxuICAgICAgICAgICAgWy9eKCArKS4rJC8sICdzdHJpbmcnLCAnQG11bHRpU3RyaW5nQ29udGludWVkLiQxJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIEZ1cnRoZXIgbGluZXMgb2YgYSBCbG9jayBTdHlsZVxyXG4gICAgICAgIC8vICAgV29ya2Fyb3VuZCBmb3IgaW5kZW50YXRpb24gZGV0ZWN0aW9uXHJcbiAgICAgICAgbXVsdGlTdHJpbmdDb250aW51ZWQ6IFtcclxuICAgICAgICAgICAgWy9eKCAqKS4rJC8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJDE9PSRTMic6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiB7IHRva2VuOiAnQHJlbWF0Y2gnLCBuZXh0OiAnQHBvcGFsbCcgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3aGl0ZXNwYWNlOiBbXHJcbiAgICAgICAgICAgIFsvWyBcXHRcXHJcXG5dKy8sICd3aGl0ZSddXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBPbmx5IGxpbmUgY29tbWVudHNcclxuICAgICAgICBjb21tZW50OiBbXHJcbiAgICAgICAgICAgIFsvIy4qJC8sICdjb21tZW50J11cclxuICAgICAgICBdLFxyXG4gICAgICAgIC8vIFN0YXJ0IEZsb3cgQ29sbGVjdGlvbnNcclxuICAgICAgICBmbG93Q29sbGVjdGlvbnM6IFtcclxuICAgICAgICAgICAgWy9cXFsvLCAnQGJyYWNrZXRzJywgJ0BhcnJheSddLFxyXG4gICAgICAgICAgICBbL1xcey8sICdAYnJhY2tldHMnLCAnQG9iamVjdCddXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBTdGFydCBGbG93IFNjYWxhcnMgKHF1b3RlZCBzdHJpbmdzKVxyXG4gICAgICAgIGZsb3dTY2FsYXJzOiBbXHJcbiAgICAgICAgICAgIFsvXCIoW15cIlxcXFxdfFxcXFwuKSokLywgJ3N0cmluZy5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvJyhbXidcXFxcXXxcXFxcLikqJC8sICdzdHJpbmcuaW52YWxpZCddLFxyXG4gICAgICAgICAgICBbLydbXiddKicvLCAnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgIFsvXCIvLCAnc3RyaW5nJywgJ0Bkb3VibGVRdW90ZWRTdHJpbmcnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgZG91YmxlUXVvdGVkU3RyaW5nOiBbXHJcbiAgICAgICAgICAgIFsvW15cXFxcXCJdKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9AZXNjYXBlcy8sICdzdHJpbmcuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXC4vLCAnc3RyaW5nLmVzY2FwZS5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvXCIvLCAnc3RyaW5nJywgJ0Bwb3AnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgLy8gU3RhcnQgQmxvY2sgU2NhbGFyXHJcbiAgICAgICAgYmxvY2tTdHlsZTogW1xyXG4gICAgICAgICAgICBbL1s+fF1bMC05XSpbKy1dPyQvLCAnb3BlcmF0b3JzJywgJ0BtdWx0aVN0cmluZyddXHJcbiAgICAgICAgXSxcclxuICAgICAgICAvLyBOdW1iZXJzIGluIEZsb3cgQ29sbGVjdGlvbnMgKHRlcm1pbmF0ZSB3aXRoICxdfSlcclxuICAgICAgICBmbG93TnVtYmVyOiBbXHJcbiAgICAgICAgICAgIFsvQG51bWJlckludGVnZXIoPz1bIFxcdF0qWyxcXF1cXH1dKS8sICdudW1iZXInXSxcclxuICAgICAgICAgICAgWy9AbnVtYmVyRmxvYXQoPz1bIFxcdF0qWyxcXF1cXH1dKS8sICdudW1iZXIuZmxvYXQnXSxcclxuICAgICAgICAgICAgWy9AbnVtYmVyT2N0YWwoPz1bIFxcdF0qWyxcXF1cXH1dKS8sICdudW1iZXIub2N0YWwnXSxcclxuICAgICAgICAgICAgWy9AbnVtYmVySGV4KD89WyBcXHRdKlssXFxdXFx9XSkvLCAnbnVtYmVyLmhleCddLFxyXG4gICAgICAgICAgICBbL0BudW1iZXJJbmZpbml0eSg/PVsgXFx0XSpbLFxcXVxcfV0pLywgJ251bWJlci5pbmZpbml0eSddLFxyXG4gICAgICAgICAgICBbL0BudW1iZXJOYU4oPz1bIFxcdF0qWyxcXF1cXH1dKS8sICdudW1iZXIubmFuJ10sXHJcbiAgICAgICAgICAgIFsvQG51bWJlckRhdGUoPz1bIFxcdF0qWyxcXF1cXH1dKS8sICdudW1iZXIuZGF0ZSddXHJcbiAgICAgICAgXSxcclxuICAgICAgICB0YWdIYW5kbGU6IFtcclxuICAgICAgICAgICAgWy9cXCFbXiBdKi8sICd0YWcnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgYW5jaG9yOiBbXHJcbiAgICAgICAgICAgIFsvWyYqXVteIF0rLywgJ25hbWVzcGFjZSddXHJcbiAgICAgICAgXVxyXG4gICAgfVxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9