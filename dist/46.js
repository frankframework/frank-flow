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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3Jlc3RydWN0dXJlZHRleHQvcmVzdHJ1Y3R1cmVkdGV4dC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQSxXQUFXLEtBQUs7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLFNBQVMsWUFBWSxHQUFHO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVM7QUFDVDtBQUNBO0FBQ0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPO0FBQ1A7QUFDQTtBQUNBLDBCQUEwQjtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsNkNBQTZDLGFBQWEsRUFBRTtBQUM1RCxtQ0FBbUM7QUFDbkMsK0JBQStCLFNBQVM7QUFDeEM7QUFDQTtBQUNBO0FBQ0E7QUFDQSw2QkFBNkIsR0FBRyxHQUFHLElBQUk7QUFDdkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhLHFCQUFxQjtBQUNsQyxhQUFhLG1DQUFtQztBQUNoRCxhQUFhLDJCQUEyQjtBQUN4QztBQUNBO0FBQ0E7QUFDQSxhQUFhLHdCQUF3QjtBQUNyQztBQUNBLGFBQWEsd0JBQXdCO0FBQ3JDO0FBQ0EsdURBQXVELHFDQUFxQztBQUM1RjtBQUNBLDhEQUE4RCxnQ0FBZ0M7QUFDOUY7QUFDQSwwREFBMEQscUNBQXFDO0FBQy9GO0FBQ0E7QUFDQSw4RUFBOEUscUNBQXFDO0FBQ25ILDBDQUEwQyxJQUFJO0FBQzlDO0FBQ0Esa0NBQWtDLCtCQUErQjtBQUNqRTtBQUNBO0FBQ0EsYUFBYSxpQ0FBaUM7QUFDOUMsYUFBYSxpQ0FBaUM7QUFDOUM7QUFDQSxpQ0FBaUMsSUFBSTtBQUNyQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDZEQUE2RCxzQ0FBc0M7QUFDbkc7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9EQUFvRCxzQ0FBc0M7QUFDMUYsZ0VBQWdFLHNDQUFzQztBQUN0RyxrREFBa0Qsc0NBQXNDO0FBQ3hGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiNDYuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5leHBvcnQgdmFyIGNvbmYgPSB7XHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIFsneycsICd9J10sXHJcbiAgICAgICAgWydbJywgJ10nXSxcclxuICAgICAgICBbJygnLCAnKSddXHJcbiAgICBdLFxyXG4gICAgYXV0b0Nsb3NpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJzwnLCBjbG9zZTogJz4nLCBub3RJbjogWydzdHJpbmcnXSB9XHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICdgJywgY2xvc2U6ICdgJyB9LFxyXG4gICAgXSxcclxuICAgIGZvbGRpbmc6IHtcclxuICAgICAgICBtYXJrZXJzOiB7XHJcbiAgICAgICAgICAgIHN0YXJ0OiBuZXcgUmVnRXhwKFwiXlxcXFxzKjwhLS1cXFxccyojP3JlZ2lvblxcXFxiLiotLT5cIiksXHJcbiAgICAgICAgICAgIGVuZDogbmV3IFJlZ0V4cChcIl5cXFxccyo8IS0tXFxcXHMqIz9lbmRyZWdpb25cXFxcYi4qLS0+XCIpXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5leHBvcnQgdmFyIGxhbmd1YWdlID0ge1xyXG4gICAgZGVmYXVsdFRva2VuOiAnJyxcclxuICAgIHRva2VuUG9zdGZpeDogJy5yc3QnLFxyXG4gICAgY29udHJvbDogL1tcXFxcYCpfXFxbXFxde30oKSMrXFwtXFwuIV0vLFxyXG4gICAgZXNjYXBlczogL1xcXFwoPzpAY29udHJvbCkvLFxyXG4gICAgZW1wdHk6IFtcclxuICAgICAgICAnYXJlYScsICdiYXNlJywgJ2Jhc2Vmb250JywgJ2JyJywgJ2NvbCcsICdmcmFtZScsXHJcbiAgICAgICAgJ2hyJywgJ2ltZycsICdpbnB1dCcsICdpc2luZGV4JywgJ2xpbmsnLCAnbWV0YScsICdwYXJhbSdcclxuICAgIF0sXHJcbiAgICBhbHBoYW51bWVyaWNzOiAvW0EtWmEtejAtOV0vLFxyXG4gICAgYWxwaGFudW1lcmljc3BsdXM6IC9bQS1aYS16MC05LV8rOi5dLyxcclxuICAgIHNpbXBsZVJlZk5hbWVXaXRob3V0QnE6IC8oPzpAYWxwaGFudW1lcmljc0BhbHBoYW51bWVyaWNzcGx1cypAYWxwaGFudW1lcmljcykrfCg/OkBhbHBoYW51bWVyaWNzKykvLFxyXG4gICAgc2ltcGxlUmVmTmFtZTogLyg/OmBAc2ltcGxlUmVmTmFtZVdpdGhvdXRCcWB8QHNpbXBsZVJlZk5hbWVXaXRob3V0QnEpLyxcclxuICAgIHBocmFzZTogL0BzaW1wbGVSZWZOYW1lKD86XFxzQHNpbXBsZVJlZk5hbWUpKi8sXHJcbiAgICBjaXRhdGlvbk5hbWU6IC9bQS1aYS16XVtBLVphLXowLTktXy5dKi8sXHJcbiAgICBibG9ja0xpdGVyYWxTdGFydDogLyg/OlshXCIjJCUmJygpKissLS4vOjs8PT4/QFxcW1xcXV5fYHt8fX5dfFtcXHNdKS8sXHJcbiAgICBwcmVjZWRpbmdDaGFyczogLyg/OlsgLTovJ1wiPChbe10pLyxcclxuICAgIGZvbGxvd2luZ0NoYXJzOiAvKD86WyAtLiw6OyE/LydcIilcXF19Pl18JCkvLFxyXG4gICAgcHVuY3R1YXRpb246IC8oPXwtfH58YHwjfFwifFxcXnxcXCt8XFwqfDp8XFwufCd8X3xcXCspLyxcclxuICAgIHRva2VuaXplcjoge1xyXG4gICAgICAgIHJvb3Q6IFtcclxuICAgICAgICAgICAgLy9zZWN0aW9uc1xyXG4gICAgICAgICAgICBbL14oQHB1bmN0dWF0aW9uezMsfSQpezEsMX0/LywgJ2tleXdvcmQnXSxcclxuICAgICAgICAgICAgLy9saW5lLWJsb2Nrc1xyXG4gICAgICAgICAgICAvL05vIHJ1bGVzIG9uIGl0XHJcbiAgICAgICAgICAgIC8vYnVsbGV0LWxpc3RzXHJcbiAgICAgICAgICAgIFsvXlxccyooW1xcKlxcLSvigKPigKJdfFthLXpBLVowLTldK1xcLnxcXChbYS16QS1aMC05XStcXCl8W2EtekEtWjAtOV0rXFwpKVxccy8sICdrZXl3b3JkJ10sXHJcbiAgICAgICAgICAgIC8vbGl0ZXJhbC1ibG9ja3NcclxuICAgICAgICAgICAgWy8oWyBdOjopXFxzKiQvLCAna2V5d29yZCcsICdAYmxhbmtMaW5lT2ZMaXRlcmFsQmxvY2tzJ10sXHJcbiAgICAgICAgICAgIFsvKDo6KVxccyokLywgJ2tleXdvcmQnLCAnQGJsYW5rTGluZU9mTGl0ZXJhbEJsb2NrcyddLFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAdGFibGVzJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAZXhwbGljaXRNYXJrdXBCbG9ja3MnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BpbmxpbmVNYXJrdXAnIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBleHBsaWNpdE1hcmt1cEJsb2NrczogW1xyXG4gICAgICAgICAgICAvL2NpdGF0aW9uc1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAY2l0YXRpb25zJyB9LFxyXG4gICAgICAgICAgICAvL2Zvb3Rub3Rlc1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAZm9vdG5vdGVzJyB9LFxyXG4gICAgICAgICAgICAvL2RpcmVjdGl2ZXNcclxuICAgICAgICAgICAgWy9eKFxcLlxcLlxccykoQHNpbXBsZVJlZk5hbWUpKDo6XFxzKSguKikkLywgW3sgdG9rZW46ICcnLCBuZXh0OiAnc3Vic2VxdWVudExpbmVzJyB9LCAna2V5d29yZCcsICcnLCAnJ11dLFxyXG4gICAgICAgICAgICAvL2h5cGVybGluay10YXJnZXRzXHJcbiAgICAgICAgICAgIFsvXihcXC5cXC4pKFxccyspKF8pKEBzaW1wbGVSZWZOYW1lKSg6KShcXHMrKSguKikvLCBbeyB0b2tlbjogJycsIG5leHQ6ICdoeXBlcmxpbmtzJyB9LCAnJywgJycsICdzdHJpbmcubGluaycsICcnLCAnJywgJ3N0cmluZy5saW5rJ11dLFxyXG4gICAgICAgICAgICAvL2Fub255bW91cy1oeXBlcmxpbmtzXHJcbiAgICAgICAgICAgIFsvXigoPzooPzpcXC5cXC4pKD86XFxzKykpPykoX18pKDopKFxccyspKC4qKS8sIFt7IHRva2VuOiAnJywgbmV4dDogJ3N1YnNlcXVlbnRMaW5lcycgfSwgJycsICcnLCAnJywgJ3N0cmluZy5saW5rJ11dLFxyXG4gICAgICAgICAgICBbL14oX19cXHMrKSguKykvLCBbJycsICdzdHJpbmcubGluayddXSxcclxuICAgICAgICAgICAgLy9zdWJzdGl0dXRpb24tZGVmaW5pdGlvbnNcclxuICAgICAgICAgICAgWy9eKFxcLlxcLikoIFxcfCkoW158IF0rW158XSpbXnwgXSopKFxcfCApKEBzaW1wbGVSZWZOYW1lKSg6OiAuKikvLCBbeyB0b2tlbjogJycsIG5leHQ6ICdzdWJzZXF1ZW50TGluZXMnIH0sICcnLCAnc3RyaW5nLmxpbmsnLCAnJywgJ2tleXdvcmQnLCAnJ10sICdAcmF3QmxvY2tzJ10sXHJcbiAgICAgICAgICAgIFsvKFxcfCkoW158IF0rW158XSpbXnwgXSopKFxcfF97MCwyfSkvLCBbJycsICdzdHJpbmcubGluaycsICcnXV0sXHJcbiAgICAgICAgICAgIC8vY29tbWVudHNcclxuICAgICAgICAgICAgWy9eKFxcLlxcLikoWyBdLiopJC8sIFt7IHRva2VuOiAnJywgbmV4dDogJ0Bjb21tZW50cycgfSwgJ2NvbW1lbnQnXV0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBpbmxpbmVNYXJrdXA6IFtcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGNpdGF0aW9uc1JlZmVyZW5jZScgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQGZvb3Rub3Rlc1JlZmVyZW5jZScgfSxcclxuICAgICAgICAgICAgLy9oeXBlcmxpbmstcmVmZXJlbmNlc1xyXG4gICAgICAgICAgICBbLyhAc2ltcGxlUmVmTmFtZSkoX3sxLDJ9KS8sIFsnc3RyaW5nLmxpbmsnLCAnJ11dLFxyXG4gICAgICAgICAgICAvL2VtYmVkZGVkLXVyaXMtYW5kLWFsaWFzZXNcclxuICAgICAgICAgICAgWy8oYCkoW148YF0rXFxzKykoPCkoLiopKD4pKGApKF8pLywgWycnLCAnc3RyaW5nLmxpbmsnLCAnJywgJ3N0cmluZy5saW5rJywgJycsICcnLCAnJ11dLFxyXG4gICAgICAgICAgICAvL2VtcGhhc2lzXHJcbiAgICAgICAgICAgIFsvXFwqXFwqKFteXFxcXCpdfFxcKig/IVxcKikpK1xcKlxcKi8sICdzdHJvbmcnXSxcclxuICAgICAgICAgICAgWy9cXCpbXipdK1xcKi8sICdlbXBoYXNpcyddLFxyXG4gICAgICAgICAgICAvL2lubGluZS1saXRlcmFsc1xyXG4gICAgICAgICAgICBbLyhgYCkoKD86W15gXXxcXGAoPyFgKSkrKShgYCkvLCBbJycsICdrZXl3b3JkJywgJyddXSxcclxuICAgICAgICAgICAgWy8oX19cXHMrKSguKykvLCBbJycsICdrZXl3b3JkJ11dLFxyXG4gICAgICAgICAgICAvL2ludGVycHJldGVkLXRleHRcclxuICAgICAgICAgICAgWy8oOikoKD86QHNpbXBsZVJlZk5hbWVXaXRob3V0QnEpPykoOmApKFteYF0rKShgKS8sIFsnJywgJ2tleXdvcmQnLCAnJywgJycsICcnXV0sXHJcbiAgICAgICAgICAgIFsvKGApKFteYF0rKShgOikoKD86QHNpbXBsZVJlZk5hbWVXaXRob3V0QnEpPykoOikvLCBbJycsICcnLCAnJywgJ2tleXdvcmQnLCAnJ11dLFxyXG4gICAgICAgICAgICBbLyhgKShbXmBdKykoYCkvLCAnJ10sXHJcbiAgICAgICAgICAgIC8vaW5saW5lLWludGVybmFsLXRhcmdldHNcclxuICAgICAgICAgICAgWy8oX2ApKEBwaHJhc2UpKGApLywgWycnLCAnc3RyaW5nLmxpbmsnLCAnJ11dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY2l0YXRpb25zOiBbXHJcbiAgICAgICAgICAgIFsvXihcXC5cXC5cXHMrXFxbKSgoPzpAY2l0YXRpb25OYW1lKSkoXFxdXFxzKykoLiopLywgW3sgdG9rZW46ICcnLCBuZXh0OiAnQHN1YnNlcXVlbnRMaW5lcycgfSwgJ3N0cmluZy5saW5rJywgJycsICcnXV0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjaXRhdGlvbnNSZWZlcmVuY2U6IFtcclxuICAgICAgICAgICAgWy8oXFxbKShAY2l0YXRpb25OYW1lKShcXF1fKS8sIFsnJywgJ3N0cmluZy5saW5rJywgJyddXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGZvb3Rub3RlczogW1xyXG4gICAgICAgICAgICBbL14oXFwuXFwuXFxzK1xcWykoKD86WzAtOV0rKSkoXFxdXFxzKy4qKS8sIFt7IHRva2VuOiAnJywgbmV4dDogJ0BzdWJzZXF1ZW50TGluZXMnIH0sICdzdHJpbmcubGluaycsICcnXV0sXHJcbiAgICAgICAgICAgIFsvXihcXC5cXC5cXHMrXFxbKSgoPzojQHNpbXBsZVJlZk5hbWU/KSkoXFxdXFxzKykoLiopLywgW3sgdG9rZW46ICcnLCBuZXh0OiAnQHN1YnNlcXVlbnRMaW5lcycgfSwgJ3N0cmluZy5saW5rJywgJycsICcnXV0sXHJcbiAgICAgICAgICAgIFsvXihcXC5cXC5cXHMrXFxbKSgoPzpcXCopKShcXF1cXHMrKSguKikvLCBbeyB0b2tlbjogJycsIG5leHQ6ICdAc3Vic2VxdWVudExpbmVzJyB9LCAnc3RyaW5nLmxpbmsnLCAnJywgJyddXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIGZvb3Rub3Rlc1JlZmVyZW5jZTogW1xyXG4gICAgICAgICAgICBbLyhcXFspKFswLTldKykoXFxdKShfKS8sIFsnJywgJ3N0cmluZy5saW5rJywgJycsICcnXV0sXHJcbiAgICAgICAgICAgIFsvKFxcWykoI0BzaW1wbGVSZWZOYW1lPykoXFxdKShfKS8sIFsnJywgJ3N0cmluZy5saW5rJywgJycsICcnXV0sXHJcbiAgICAgICAgICAgIFsvKFxcWykoXFwqKShcXF0pKF8pLywgWycnLCAnc3RyaW5nLmxpbmsnLCAnJywgJyddXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgYmxhbmtMaW5lT2ZMaXRlcmFsQmxvY2tzOiBbXHJcbiAgICAgICAgICAgIFsvXiQvLCAnJywgJ0BzdWJzZXF1ZW50TGluZXNPZkxpdGVyYWxCbG9ja3MnXSxcclxuICAgICAgICAgICAgWy9eLiokLywgJycsICdAcG9wJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzdWJzZXF1ZW50TGluZXNPZkxpdGVyYWxCbG9ja3M6IFtcclxuICAgICAgICAgICAgWy8oQGJsb2NrTGl0ZXJhbFN0YXJ0KykoLiopLywgWydrZXl3b3JkJywgJyddXSxcclxuICAgICAgICAgICAgWy9eKD8hYmxvY2tMaXRlcmFsU3RhcnQpLywgJycsICdAcG9wYWxsJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIHN1YnNlcXVlbnRMaW5lczogW1xyXG4gICAgICAgICAgICBbL15bXFxzXSsuKi8sICcnXSxcclxuICAgICAgICAgICAgWy9eKD8hXFxzKS8sICcnLCAnQHBvcCddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgaHlwZXJsaW5rczogW1xyXG4gICAgICAgICAgICBbL15bXFxzXSsuKi8sICdzdHJpbmcubGluayddLFxyXG4gICAgICAgICAgICBbL14oPyFcXHMpLywgJycsICdAcG9wJ10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjb21tZW50czogW1xyXG4gICAgICAgICAgICBbL15bXFxzXSsuKi8sICdjb21tZW50J10sXHJcbiAgICAgICAgICAgIFsvXig/IVxccykvLCAnJywgJ0Bwb3AnXSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHRhYmxlczogW1xyXG4gICAgICAgICAgICBbL1xcKy1bKy1dKy8sICdrZXl3b3JkJ10sXHJcbiAgICAgICAgICAgIFsvXFwrPVsrPV0rLywgJ2tleXdvcmQnXSxcclxuICAgICAgICBdLFxyXG4gICAgfVxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9