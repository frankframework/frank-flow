(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[14],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/csp/csp.js":
/*!**********************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/csp/csp.js ***!
  \**********************************************************************/
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
    brackets: [],
    autoClosingPairs: [],
    surroundingPairs: []
};
var language = {
    // Set defaultToken to invalid to see what you do not tokenize yet
    // defaultToken: 'invalid',
    keywords: [],
    typeKeywords: [],
    tokenPostfix: '.csp',
    operators: [],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    tokenizer: {
        root: [
            [/child-src/, 'string.quote'],
            [/connect-src/, 'string.quote'],
            [/default-src/, 'string.quote'],
            [/font-src/, 'string.quote'],
            [/frame-src/, 'string.quote'],
            [/img-src/, 'string.quote'],
            [/manifest-src/, 'string.quote'],
            [/media-src/, 'string.quote'],
            [/object-src/, 'string.quote'],
            [/script-src/, 'string.quote'],
            [/style-src/, 'string.quote'],
            [/worker-src/, 'string.quote'],
            [/base-uri/, 'string.quote'],
            [/plugin-types/, 'string.quote'],
            [/sandbox/, 'string.quote'],
            [/disown-opener/, 'string.quote'],
            [/form-action/, 'string.quote'],
            [/frame-ancestors/, 'string.quote'],
            [/report-uri/, 'string.quote'],
            [/report-to/, 'string.quote'],
            [/upgrade-insecure-requests/, 'string.quote'],
            [/block-all-mixed-content/, 'string.quote'],
            [/require-sri-for/, 'string.quote'],
            [/reflected-xss/, 'string.quote'],
            [/referrer/, 'string.quote'],
            [/policy-uri/, 'string.quote'],
            [/'self'/, 'string.quote'],
            [/'unsafe-inline'/, 'string.quote'],
            [/'unsafe-eval'/, 'string.quote'],
            [/'strict-dynamic'/, 'string.quote'],
            [/'unsafe-hashed-attributes'/, 'string.quote']
        ]
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL2NzcC9jc3AuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ2E7QUFDTjtBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhDQUE4QyxJQUFJLGNBQWMsRUFBRSxjQUFjLEVBQUU7QUFDbEY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IjE0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgYnJhY2tldHM6IFtdLFxyXG4gICAgYXV0b0Nsb3NpbmdQYWlyczogW10sXHJcbiAgICBzdXJyb3VuZGluZ1BhaXJzOiBbXVxyXG59O1xyXG5leHBvcnQgdmFyIGxhbmd1YWdlID0ge1xyXG4gICAgLy8gU2V0IGRlZmF1bHRUb2tlbiB0byBpbnZhbGlkIHRvIHNlZSB3aGF0IHlvdSBkbyBub3QgdG9rZW5pemUgeWV0XHJcbiAgICAvLyBkZWZhdWx0VG9rZW46ICdpbnZhbGlkJyxcclxuICAgIGtleXdvcmRzOiBbXSxcclxuICAgIHR5cGVLZXl3b3JkczogW10sXHJcbiAgICB0b2tlblBvc3RmaXg6ICcuY3NwJyxcclxuICAgIG9wZXJhdG9yczogW10sXHJcbiAgICBzeW1ib2xzOiAvWz0+PCF+PzomfCtcXC0qXFwvXFxeJV0rLyxcclxuICAgIGVzY2FwZXM6IC9cXFxcKD86W2FiZm5ydHZcXFxcXCInXXx4WzAtOUEtRmEtZl17MSw0fXx1WzAtOUEtRmEtZl17NH18VVswLTlBLUZhLWZdezh9KS8sXHJcbiAgICB0b2tlbml6ZXI6IHtcclxuICAgICAgICByb290OiBbXHJcbiAgICAgICAgICAgIFsvY2hpbGQtc3JjLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL2Nvbm5lY3Qtc3JjLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL2RlZmF1bHQtc3JjLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL2ZvbnQtc3JjLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL2ZyYW1lLXNyYy8sICdzdHJpbmcucXVvdGUnXSxcclxuICAgICAgICAgICAgWy9pbWctc3JjLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL21hbmlmZXN0LXNyYy8sICdzdHJpbmcucXVvdGUnXSxcclxuICAgICAgICAgICAgWy9tZWRpYS1zcmMvLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvb2JqZWN0LXNyYy8sICdzdHJpbmcucXVvdGUnXSxcclxuICAgICAgICAgICAgWy9zY3JpcHQtc3JjLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL3N0eWxlLXNyYy8sICdzdHJpbmcucXVvdGUnXSxcclxuICAgICAgICAgICAgWy93b3JrZXItc3JjLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL2Jhc2UtdXJpLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL3BsdWdpbi10eXBlcy8sICdzdHJpbmcucXVvdGUnXSxcclxuICAgICAgICAgICAgWy9zYW5kYm94LywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL2Rpc293bi1vcGVuZXIvLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvZm9ybS1hY3Rpb24vLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvZnJhbWUtYW5jZXN0b3JzLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL3JlcG9ydC11cmkvLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvcmVwb3J0LXRvLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL3VwZ3JhZGUtaW5zZWN1cmUtcmVxdWVzdHMvLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvYmxvY2stYWxsLW1peGVkLWNvbnRlbnQvLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvcmVxdWlyZS1zcmktZm9yLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbL3JlZmxlY3RlZC14c3MvLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvcmVmZXJyZXIvLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvcG9saWN5LXVyaS8sICdzdHJpbmcucXVvdGUnXSxcclxuICAgICAgICAgICAgWy8nc2VsZicvLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvJ3Vuc2FmZS1pbmxpbmUnLywgJ3N0cmluZy5xdW90ZSddLFxyXG4gICAgICAgICAgICBbLyd1bnNhZmUtZXZhbCcvLCAnc3RyaW5nLnF1b3RlJ10sXHJcbiAgICAgICAgICAgIFsvJ3N0cmljdC1keW5hbWljJy8sICdzdHJpbmcucXVvdGUnXSxcclxuICAgICAgICAgICAgWy8ndW5zYWZlLWhhc2hlZC1hdHRyaWJ1dGVzJy8sICdzdHJpbmcucXVvdGUnXVxyXG4gICAgICAgIF1cclxuICAgIH1cclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIifQ==