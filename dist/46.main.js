(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[46],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/restructuredtext/restructuredtext.js":
/*!************************************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/restructuredtext/restructuredtext.js ***!
  \************************************************************************************************/
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
    tokenPostfix: '.rst',
    control: /[\\`*_\[\]{}()#+\-\.!]/,
    escapes: /\\(?:@control)/,
    empty: [
        'area', 'base', 'basefont', 'br', 'col', 'frame',
        'hr', 'img', 'input', 'isindex', 'link', 'meta', 'param'
    ],
    alphanumerics: /[A-Za-z0-9]/,
    alphanumericsplus: /[A-Za-z0-9-_+:.]/,
    simpleRefNameWithoutBq: /(?:@alphanumerics@alphanumericsplus*@alphanumerics)+|(?:@alphanumerics+)/,
    simpleRefName: /(?:`@simpleRefNameWithoutBq`|@simpleRefNameWithoutBq)/,
    phrase: /@simpleRefName(?:\s@simpleRefName)*/,
    citationName: /[A-Za-z][A-Za-z0-9-_.]*/,
    blockLiteralStart: /(?:[!"#$%&'()*+,-./:;<=>?@\[\]^_`{|}~]|[\s])/,
    precedingChars: /(?:[ -:/'"<([{])/,
    followingChars: /(?:[ -.,:;!?/'")\]}>]|$)/,
    punctuation: /(=|-|~|`|#|"|\^|\+|\*|:|\.|'|_|\+)/,
    tokenizer: {
        root: [
            //sections
            [/^(@punctuation{3,}$){1,1}?/, 'keyword'],
            //line-blocks
            //No rules on it
            //bullet-lists
            [/^\s*([\*\-+‣•]|[a-zA-Z0-9]+\.|\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+\))\s/, 'keyword'],
            //literal-blocks
            [/([ ]::)\s*$/, 'keyword', '@blankLineOfLiteralBlocks'],
            [/(::)\s*$/, 'keyword', '@blankLineOfLiteralBlocks'],
            { include: '@tables' },
            { include: '@explicitMarkupBlocks' },
            { include: '@inlineMarkup' },
        ],
        explicitMarkupBlocks: [
            //citations
            { include: '@citations' },
            //footnotes
            { include: '@footnotes' },
            //directives
            [/^(\.\.\s)(@simpleRefName)(::\s)(.*)$/, [{ token: '', next: 'subsequentLines' }, 'keyword', '', '']],
            //hyperlink-targets
            [/^(\.\.)(\s+)(_)(@simpleRefName)(:)(\s+)(.*)/, [{ token: '', next: 'hyperlinks' }, '', '', 'string.link', '', '', 'string.link']],
            //anonymous-hyperlinks
            [/^((?:(?:\.\.)(?:\s+))?)(__)(:)(\s+)(.*)/, [{ token: '', next: 'subsequentLines' }, '', '', '', 'string.link']],
            [/^(__\s+)(.+)/, ['', 'string.link']],
            //substitution-definitions
            [/^(\.\.)( \|)([^| ]+[^|]*[^| ]*)(\| )(@simpleRefName)(:: .*)/, [{ token: '', next: 'subsequentLines' }, '', 'string.link', '', 'keyword', ''], '@rawBlocks'],
            [/(\|)([^| ]+[^|]*[^| ]*)(\|_{0,2})/, ['', 'string.link', '']],
            //comments
            [/^(\.\.)([ ].*)$/, [{ token: '', next: '@comments' }, 'comment']],
        ],
        inlineMarkup: [
            { include: '@citationsReference' },
            { include: '@footnotesReference' },
            //hyperlink-references
            [/(@simpleRefName)(_{1,2})/, ['string.link', '']],
            //embedded-uris-and-aliases
            [/(`)([^<`]+\s+)(<)(.*)(>)(`)(_)/, ['', 'string.link', '', 'string.link', '', '', '']],
            //emphasis
            [/\*\*([^\\*]|\*(?!\*))+\*\*/, 'strong'],
            [/\*[^*]+\*/, 'emphasis'],
            //inline-literals
            [/(``)((?:[^`]|\`(?!`))+)(``)/, ['', 'keyword', '']],
            [/(__\s+)(.+)/, ['', 'keyword']],
            //interpreted-text
            [/(:)((?:@simpleRefNameWithoutBq)?)(:`)([^`]+)(`)/, ['', 'keyword', '', '', '']],
            [/(`)([^`]+)(`:)((?:@simpleRefNameWithoutBq)?)(:)/, ['', '', '', 'keyword', '']],
            [/(`)([^`]+)(`)/, ''],
            //inline-internal-targets
            [/(_`)(@phrase)(`)/, ['', 'string.link', '']],
        ],
        citations: [
            [/^(\.\.\s+\[)((?:@citationName))(\]\s+)(.*)/, [{ token: '', next: '@subsequentLines' }, 'string.link', '', '']],
        ],
        citationsReference: [
            [/(\[)(@citationName)(\]_)/, ['', 'string.link', '']],
        ],
        footnotes: [
            [/^(\.\.\s+\[)((?:[0-9]+))(\]\s+.*)/, [{ token: '', next: '@subsequentLines' }, 'string.link', '']],
            [/^(\.\.\s+\[)((?:#@simpleRefName?))(\]\s+)(.*)/, [{ token: '', next: '@subsequentLines' }, 'string.link', '', '']],
            [/^(\.\.\s+\[)((?:\*))(\]\s+)(.*)/, [{ token: '', next: '@subsequentLines' }, 'string.link', '', '']],
        ],
        footnotesReference: [
            [/(\[)([0-9]+)(\])(_)/, ['', 'string.link', '', '']],
            [/(\[)(#@simpleRefName?)(\])(_)/, ['', 'string.link', '', '']],
            [/(\[)(\*)(\])(_)/, ['', 'string.link', '', '']]
        ],
        blankLineOfLiteralBlocks: [
            [/^$/, '', '@subsequentLinesOfLiteralBlocks'],
            [/^.*$/, '', '@pop'],
        ],
        subsequentLinesOfLiteralBlocks: [
            [/(@blockLiteralStart+)(.*)/, ['keyword', '']],
            [/^(?!blockLiteralStart)/, '', '@popall']
        ],
        subsequentLines: [
            [/^[\s]+.*/, ''],
            [/^(?!\s)/, '', '@pop'],
        ],
        hyperlinks: [
            [/^[\s]+.*/, 'string.link'],
            [/^(?!\s)/, '', '@pop'],
        ],
        comments: [
            [/^[\s]+.*/, 'comment'],
            [/^(?!\s)/, '', '@pop'],
        ],
        tables: [
            [/\+-[+-]+/, 'keyword'],
            [/\+=[+=]+/, 'keyword'],
        ],
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3Jlc3RydWN0dXJlZHRleHQvcmVzdHJ1Y3R1cmVkdGV4dC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQSxXQUFXLEtBQUs7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLFNBQVMsWUFBWSxHQUFHO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVM7QUFDVDtBQUNBO0FBQ0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPO0FBQ1A7QUFDQTtBQUNBLDBCQUEwQjtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsNkNBQTZDLGFBQWEsRUFBRTtBQUM1RCxtQ0FBbUM7QUFDbkMsK0JBQStCLFNBQVM7QUFDeEM7QUFDQTtBQUNBO0FBQ0E7QUFDQSw2QkFBNkIsR0FBRyxHQUFHLElBQUk7QUFDdkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhLHFCQUFxQjtBQUNsQyxhQUFhLG1DQUFtQztBQUNoRCxhQUFhLDJCQUEyQjtBQUN4QztBQUNBO0FBQ0E7QUFDQSxhQUFhLHdCQUF3QjtBQUNyQztBQUNBLGFBQWEsd0JBQXdCO0FBQ3JDO0FBQ0EsdURBQXVELHFDQUFxQztBQUM1RjtBQUNBLDhEQUE4RCxnQ0FBZ0M7QUFDOUY7QUFDQSwwREFBMEQscUNBQXFDO0FBQy9GO0FBQ0E7QUFDQSw4RUFBOEUscUNBQXFDO0FBQ25ILDBDQUEwQyxJQUFJO0FBQzlDO0FBQ0Esa0NBQWtDLCtCQUErQjtBQUNqRTtBQUNBO0FBQ0EsYUFBYSxpQ0FBaUM7QUFDOUMsYUFBYSxpQ0FBaUM7QUFDOUM7QUFDQSxpQ0FBaUMsSUFBSTtBQUNyQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDZEQUE2RCxzQ0FBc0M7QUFDbkc7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9EQUFvRCxzQ0FBc0M7QUFDMUYsZ0VBQWdFLHNDQUFzQztBQUN0RyxrREFBa0Qsc0NBQXNDO0FBQ3hGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiNDYubWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cclxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG4ndXNlIHN0cmljdCc7XHJcbmV4cG9ydCB2YXIgY29uZiA9IHtcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgWyd7JywgJ30nXSxcclxuICAgICAgICBbJ1snLCAnXSddLFxyXG4gICAgICAgIFsnKCcsICcpJ11cclxuICAgIF0sXHJcbiAgICBhdXRvQ2xvc2luZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnPCcsIGNsb3NlOiAnPicsIG5vdEluOiBbJ3N0cmluZyddIH1cclxuICAgIF0sXHJcbiAgICBzdXJyb3VuZGluZ1BhaXJzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ2AnLCBjbG9zZTogJ2AnIH0sXHJcbiAgICBdLFxyXG4gICAgZm9sZGluZzoge1xyXG4gICAgICAgIG1hcmtlcnM6IHtcclxuICAgICAgICAgICAgc3RhcnQ6IG5ldyBSZWdFeHAoXCJeXFxcXHMqPCEtLVxcXFxzKiM/cmVnaW9uXFxcXGIuKi0tPlwiKSxcclxuICAgICAgICAgICAgZW5kOiBuZXcgUmVnRXhwKFwiXlxcXFxzKjwhLS1cXFxccyojP2VuZHJlZ2lvblxcXFxiLiotLT5cIilcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcbmV4cG9ydCB2YXIgbGFuZ3VhZ2UgPSB7XHJcbiAgICBkZWZhdWx0VG9rZW46ICcnLFxyXG4gICAgdG9rZW5Qb3N0Zml4OiAnLnJzdCcsXHJcbiAgICBjb250cm9sOiAvW1xcXFxgKl9cXFtcXF17fSgpIytcXC1cXC4hXS8sXHJcbiAgICBlc2NhcGVzOiAvXFxcXCg/OkBjb250cm9sKS8sXHJcbiAgICBlbXB0eTogW1xyXG4gICAgICAgICdhcmVhJywgJ2Jhc2UnLCAnYmFzZWZvbnQnLCAnYnInLCAnY29sJywgJ2ZyYW1lJyxcclxuICAgICAgICAnaHInLCAnaW1nJywgJ2lucHV0JywgJ2lzaW5kZXgnLCAnbGluaycsICdtZXRhJywgJ3BhcmFtJ1xyXG4gICAgXSxcclxuICAgIGFscGhhbnVtZXJpY3M6IC9bQS1aYS16MC05XS8sXHJcbiAgICBhbHBoYW51bWVyaWNzcGx1czogL1tBLVphLXowLTktXys6Ll0vLFxyXG4gICAgc2ltcGxlUmVmTmFtZVdpdGhvdXRCcTogLyg/OkBhbHBoYW51bWVyaWNzQGFscGhhbnVtZXJpY3NwbHVzKkBhbHBoYW51bWVyaWNzKSt8KD86QGFscGhhbnVtZXJpY3MrKS8sXHJcbiAgICBzaW1wbGVSZWZOYW1lOiAvKD86YEBzaW1wbGVSZWZOYW1lV2l0aG91dEJxYHxAc2ltcGxlUmVmTmFtZVdpdGhvdXRCcSkvLFxyXG4gICAgcGhyYXNlOiAvQHNpbXBsZVJlZk5hbWUoPzpcXHNAc2ltcGxlUmVmTmFtZSkqLyxcclxuICAgIGNpdGF0aW9uTmFtZTogL1tBLVphLXpdW0EtWmEtejAtOS1fLl0qLyxcclxuICAgIGJsb2NrTGl0ZXJhbFN0YXJ0OiAvKD86WyFcIiMkJSYnKCkqKywtLi86Ozw9Pj9AXFxbXFxdXl9ge3x9fl18W1xcc10pLyxcclxuICAgIHByZWNlZGluZ0NoYXJzOiAvKD86WyAtOi8nXCI8KFt7XSkvLFxyXG4gICAgZm9sbG93aW5nQ2hhcnM6IC8oPzpbIC0uLDo7IT8vJ1wiKVxcXX0+XXwkKS8sXHJcbiAgICBwdW5jdHVhdGlvbjogLyg9fC18fnxgfCN8XCJ8XFxefFxcK3xcXCp8OnxcXC58J3xffFxcKykvLFxyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICAvL3NlY3Rpb25zXHJcbiAgICAgICAgICAgIFsvXihAcHVuY3R1YXRpb257Myx9JCl7MSwxfT8vLCAna2V5d29yZCddLFxyXG4gICAgICAgICAgICAvL2xpbmUtYmxvY2tzXHJcbiAgICAgICAgICAgIC8vTm8gcnVsZXMgb24gaXRcclxuICAgICAgICAgICAgLy9idWxsZXQtbGlzdHNcclxuICAgICAgICAgICAgWy9eXFxzKihbXFwqXFwtK+KAo+KAol18W2EtekEtWjAtOV0rXFwufFxcKFthLXpBLVowLTldK1xcKXxbYS16QS1aMC05XStcXCkpXFxzLywgJ2tleXdvcmQnXSxcclxuICAgICAgICAgICAgLy9saXRlcmFsLWJsb2Nrc1xyXG4gICAgICAgICAgICBbLyhbIF06OilcXHMqJC8sICdrZXl3b3JkJywgJ0BibGFua0xpbmVPZkxpdGVyYWxCbG9ja3MnXSxcclxuICAgICAgICAgICAgWy8oOjopXFxzKiQvLCAna2V5d29yZCcsICdAYmxhbmtMaW5lT2ZMaXRlcmFsQmxvY2tzJ10sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0B0YWJsZXMnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BleHBsaWNpdE1hcmt1cEJsb2NrcycgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGlubGluZU1hcmt1cCcgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGV4cGxpY2l0TWFya3VwQmxvY2tzOiBbXHJcbiAgICAgICAgICAgIC8vY2l0YXRpb25zXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BjaXRhdGlvbnMnIH0sXHJcbiAgICAgICAgICAgIC8vZm9vdG5vdGVzXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0Bmb290bm90ZXMnIH0sXHJcbiAgICAgICAgICAgIC8vZGlyZWN0aXZlc1xyXG4gICAgICAgICAgICBbL14oXFwuXFwuXFxzKShAc2ltcGxlUmVmTmFtZSkoOjpcXHMpKC4qKSQvLCBbeyB0b2tlbjogJycsIG5leHQ6ICdzdWJzZXF1ZW50TGluZXMnIH0sICdrZXl3b3JkJywgJycsICcnXV0sXHJcbiAgICAgICAgICAgIC8vaHlwZXJsaW5rLXRhcmdldHNcclxuICAgICAgICAgICAgWy9eKFxcLlxcLikoXFxzKykoXykoQHNpbXBsZVJlZk5hbWUpKDopKFxccyspKC4qKS8sIFt7IHRva2VuOiAnJywgbmV4dDogJ2h5cGVybGlua3MnIH0sICcnLCAnJywgJ3N0cmluZy5saW5rJywgJycsICcnLCAnc3RyaW5nLmxpbmsnXV0sXHJcbiAgICAgICAgICAgIC8vYW5vbnltb3VzLWh5cGVybGlua3NcclxuICAgICAgICAgICAgWy9eKCg/Oig/OlxcLlxcLikoPzpcXHMrKSk/KShfXykoOikoXFxzKykoLiopLywgW3sgdG9rZW46ICcnLCBuZXh0OiAnc3Vic2VxdWVudExpbmVzJyB9LCAnJywgJycsICcnLCAnc3RyaW5nLmxpbmsnXV0sXHJcbiAgICAgICAgICAgIFsvXihfX1xccyspKC4rKS8sIFsnJywgJ3N0cmluZy5saW5rJ11dLFxyXG4gICAgICAgICAgICAvL3N1YnN0aXR1dGlvbi1kZWZpbml0aW9uc1xyXG4gICAgICAgICAgICBbL14oXFwuXFwuKSggXFx8KShbXnwgXStbXnxdKltefCBdKikoXFx8ICkoQHNpbXBsZVJlZk5hbWUpKDo6IC4qKS8sIFt7IHRva2VuOiAnJywgbmV4dDogJ3N1YnNlcXVlbnRMaW5lcycgfSwgJycsICdzdHJpbmcubGluaycsICcnLCAna2V5d29yZCcsICcnXSwgJ0ByYXdCbG9ja3MnXSxcclxuICAgICAgICAgICAgWy8oXFx8KShbXnwgXStbXnxdKltefCBdKikoXFx8X3swLDJ9KS8sIFsnJywgJ3N0cmluZy5saW5rJywgJyddXSxcclxuICAgICAgICAgICAgLy9jb21tZW50c1xyXG4gICAgICAgICAgICBbL14oXFwuXFwuKShbIF0uKikkLywgW3sgdG9rZW46ICcnLCBuZXh0OiAnQGNvbW1lbnRzJyB9LCAnY29tbWVudCddXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGlubGluZU1hcmt1cDogW1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAY2l0YXRpb25zUmVmZXJlbmNlJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAZm9vdG5vdGVzUmVmZXJlbmNlJyB9LFxyXG4gICAgICAgICAgICAvL2h5cGVybGluay1yZWZlcmVuY2VzXHJcbiAgICAgICAgICAgIFsvKEBzaW1wbGVSZWZOYW1lKShfezEsMn0pLywgWydzdHJpbmcubGluaycsICcnXV0sXHJcbiAgICAgICAgICAgIC8vZW1iZWRkZWQtdXJpcy1hbmQtYWxpYXNlc1xyXG4gICAgICAgICAgICBbLyhgKShbXjxgXStcXHMrKSg8KSguKikoPikoYCkoXykvLCBbJycsICdzdHJpbmcubGluaycsICcnLCAnc3RyaW5nLmxpbmsnLCAnJywgJycsICcnXV0sXHJcbiAgICAgICAgICAgIC8vZW1waGFzaXNcclxuICAgICAgICAgICAgWy9cXCpcXCooW15cXFxcKl18XFwqKD8hXFwqKSkrXFwqXFwqLywgJ3N0cm9uZyddLFxyXG4gICAgICAgICAgICBbL1xcKlteKl0rXFwqLywgJ2VtcGhhc2lzJ10sXHJcbiAgICAgICAgICAgIC8vaW5saW5lLWxpdGVyYWxzXHJcbiAgICAgICAgICAgIFsvKGBgKSgoPzpbXmBdfFxcYCg/IWApKSspKGBgKS8sIFsnJywgJ2tleXdvcmQnLCAnJ11dLFxyXG4gICAgICAgICAgICBbLyhfX1xccyspKC4rKS8sIFsnJywgJ2tleXdvcmQnXV0sXHJcbiAgICAgICAgICAgIC8vaW50ZXJwcmV0ZWQtdGV4dFxyXG4gICAgICAgICAgICBbLyg6KSgoPzpAc2ltcGxlUmVmTmFtZVdpdGhvdXRCcSk/KSg6YCkoW15gXSspKGApLywgWycnLCAna2V5d29yZCcsICcnLCAnJywgJyddXSxcclxuICAgICAgICAgICAgWy8oYCkoW15gXSspKGA6KSgoPzpAc2ltcGxlUmVmTmFtZVdpdGhvdXRCcSk/KSg6KS8sIFsnJywgJycsICcnLCAna2V5d29yZCcsICcnXV0sXHJcbiAgICAgICAgICAgIFsvKGApKFteYF0rKShgKS8sICcnXSxcclxuICAgICAgICAgICAgLy9pbmxpbmUtaW50ZXJuYWwtdGFyZ2V0c1xyXG4gICAgICAgICAgICBbLyhfYCkoQHBocmFzZSkoYCkvLCBbJycsICdzdHJpbmcubGluaycsICcnXV0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjaXRhdGlvbnM6IFtcclxuICAgICAgICAgICAgWy9eKFxcLlxcLlxccytcXFspKCg/OkBjaXRhdGlvbk5hbWUpKShcXF1cXHMrKSguKikvLCBbeyB0b2tlbjogJycsIG5leHQ6ICdAc3Vic2VxdWVudExpbmVzJyB9LCAnc3RyaW5nLmxpbmsnLCAnJywgJyddXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGNpdGF0aW9uc1JlZmVyZW5jZTogW1xyXG4gICAgICAgICAgICBbLyhcXFspKEBjaXRhdGlvbk5hbWUpKFxcXV8pLywgWycnLCAnc3RyaW5nLmxpbmsnLCAnJ11dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgZm9vdG5vdGVzOiBbXHJcbiAgICAgICAgICAgIFsvXihcXC5cXC5cXHMrXFxbKSgoPzpbMC05XSspKShcXF1cXHMrLiopLywgW3sgdG9rZW46ICcnLCBuZXh0OiAnQHN1YnNlcXVlbnRMaW5lcycgfSwgJ3N0cmluZy5saW5rJywgJyddXSxcclxuICAgICAgICAgICAgWy9eKFxcLlxcLlxccytcXFspKCg/OiNAc2ltcGxlUmVmTmFtZT8pKShcXF1cXHMrKSguKikvLCBbeyB0b2tlbjogJycsIG5leHQ6ICdAc3Vic2VxdWVudExpbmVzJyB9LCAnc3RyaW5nLmxpbmsnLCAnJywgJyddXSxcclxuICAgICAgICAgICAgWy9eKFxcLlxcLlxccytcXFspKCg/OlxcKikpKFxcXVxccyspKC4qKS8sIFt7IHRva2VuOiAnJywgbmV4dDogJ0BzdWJzZXF1ZW50TGluZXMnIH0sICdzdHJpbmcubGluaycsICcnLCAnJ11dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgZm9vdG5vdGVzUmVmZXJlbmNlOiBbXHJcbiAgICAgICAgICAgIFsvKFxcWykoWzAtOV0rKShcXF0pKF8pLywgWycnLCAnc3RyaW5nLmxpbmsnLCAnJywgJyddXSxcclxuICAgICAgICAgICAgWy8oXFxbKSgjQHNpbXBsZVJlZk5hbWU/KShcXF0pKF8pLywgWycnLCAnc3RyaW5nLmxpbmsnLCAnJywgJyddXSxcclxuICAgICAgICAgICAgWy8oXFxbKShcXCopKFxcXSkoXykvLCBbJycsICdzdHJpbmcubGluaycsICcnLCAnJ11dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBibGFua0xpbmVPZkxpdGVyYWxCbG9ja3M6IFtcclxuICAgICAgICAgICAgWy9eJC8sICcnLCAnQHN1YnNlcXVlbnRMaW5lc09mTGl0ZXJhbEJsb2NrcyddLFxyXG4gICAgICAgICAgICBbL14uKiQvLCAnJywgJ0Bwb3AnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHN1YnNlcXVlbnRMaW5lc09mTGl0ZXJhbEJsb2NrczogW1xyXG4gICAgICAgICAgICBbLyhAYmxvY2tMaXRlcmFsU3RhcnQrKSguKikvLCBbJ2tleXdvcmQnLCAnJ11dLFxyXG4gICAgICAgICAgICBbL14oPyFibG9ja0xpdGVyYWxTdGFydCkvLCAnJywgJ0Bwb3BhbGwnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3Vic2VxdWVudExpbmVzOiBbXHJcbiAgICAgICAgICAgIFsvXltcXHNdKy4qLywgJyddLFxyXG4gICAgICAgICAgICBbL14oPyFcXHMpLywgJycsICdAcG9wJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBoeXBlcmxpbmtzOiBbXHJcbiAgICAgICAgICAgIFsvXltcXHNdKy4qLywgJ3N0cmluZy5saW5rJ10sXHJcbiAgICAgICAgICAgIFsvXig/IVxccykvLCAnJywgJ0Bwb3AnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGNvbW1lbnRzOiBbXHJcbiAgICAgICAgICAgIFsvXltcXHNdKy4qLywgJ2NvbW1lbnQnXSxcclxuICAgICAgICAgICAgWy9eKD8hXFxzKS8sICcnLCAnQHBvcCddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgdGFibGVzOiBbXHJcbiAgICAgICAgICAgIFsvXFwrLVsrLV0rLywgJ2tleXdvcmQnXSxcclxuICAgICAgICAgICAgWy9cXCs9Wys9XSsvLCAna2V5d29yZCddLFxyXG4gICAgICAgIF0sXHJcbiAgICB9XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiIn0=