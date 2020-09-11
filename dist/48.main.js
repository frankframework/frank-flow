(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[48],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/rust/rust.js":
/*!************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/rust/rust.js ***!
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
        lineComment: '//',
        blockComment: ['/*', '*/'],
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
    ],
    autoClosingPairs: [
        { open: '[', close: ']' },
        { open: '{', close: '}' },
        { open: '(', close: ')' },
        { open: '\'', close: '\'', notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string'] },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
    ],
    folding: {
        markers: {
            start: new RegExp("^\\s*#pragma\\s+region\\b"),
            end: new RegExp("^\\s*#pragma\\s+endregion\\b")
        }
    }
};
var language = {
    tokenPostfix: '.rust',
    defaultToken: 'invalid',
    keywords: [
        'as', 'box', 'break', 'const', 'continue', 'crate', 'else', 'enum',
        'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop',
        'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self',
        'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use',
        'where', 'while', 'catch', 'default', 'union', 'static', 'abstract',
        'alignof', 'become', 'do', 'final', 'macro', 'offsetof', 'override',
        'priv', 'proc', 'pure', 'sizeof', 'typeof', 'unsized', 'virtual',
        'yield',
    ],
    typeKeywords: [
        'Self', 'm32', 'm64', 'm128', 'f80', 'f16', 'f128', 'int', 'uint',
        'float', 'char', 'bool', 'u8', 'u16', 'u32', 'u64', 'f32', 'f64', 'i8',
        'i16', 'i32', 'i64', 'str', 'Option', 'Either', 'c_float', 'c_double',
        'c_void', 'FILE', 'fpos_t', 'DIR', 'dirent', 'c_char', 'c_schar',
        'c_uchar', 'c_short', 'c_ushort', 'c_int', 'c_uint', 'c_long',
        'c_ulong', 'size_t', 'ptrdiff_t', 'clock_t', 'time_t', 'c_longlong',
        'c_ulonglong', 'intptr_t', 'uintptr_t', 'off_t', 'dev_t', 'ino_t',
        'pid_t', 'mode_t', 'ssize_t',
    ],
    constants: [
        'true', 'false', 'Some', 'None', 'Left', 'Right', 'Ok', 'Err',
    ],
    supportConstants: [
        'EXIT_FAILURE', 'EXIT_SUCCESS', 'RAND_MAX', 'EOF', 'SEEK_SET',
        'SEEK_CUR', 'SEEK_END', '_IOFBF', '_IONBF', '_IOLBF', 'BUFSIZ',
        'FOPEN_MAX', 'FILENAME_MAX', 'L_tmpnam', 'TMP_MAX', 'O_RDONLY',
        'O_WRONLY', 'O_RDWR', 'O_APPEND', 'O_CREAT', 'O_EXCL', 'O_TRUNC',
        'S_IFIFO', 'S_IFCHR', 'S_IFBLK', 'S_IFDIR', 'S_IFREG', 'S_IFMT',
        'S_IEXEC', 'S_IWRITE', 'S_IREAD', 'S_IRWXU', 'S_IXUSR', 'S_IWUSR',
        'S_IRUSR', 'F_OK', 'R_OK', 'W_OK', 'X_OK', 'STDIN_FILENO',
        'STDOUT_FILENO', 'STDERR_FILENO',
    ],
    supportMacros: [
        'format!', 'print!', 'println!', 'panic!', 'format_args!', 'unreachable!',
        'write!', 'writeln!'
    ],
    operators: [
        '!', '!=', '%', '%=', '&', '&=', '&&', '*', '*=', '+', '+=', '-', '-=',
        '->', '.', '..', '...', '/', '/=', ':', ';', '<<', '<<=', '<', '<=', '=',
        '==', '=>', '>', '>=', '>>', '>>=', '@', '^', '^=', '|', '|=', '||', '_',
        '?', '#'
    ],
    escapes: /\\([nrt0\"''\\]|x\h{2}|u\{\h{1,6}\})/,
    delimiters: /[,]/,
    symbols: /[\#\!\%\&\*\+\-\.\/\:\;\<\=\>\@\^\|_\?]+/,
    intSuffixes: /[iu](8|16|32|64|128|size)/,
    floatSuffixes: /f(32|64)/,
    tokenizer: {
        root: [
            [/[a-zA-Z][a-zA-Z0-9_]*!?|_[a-zA-Z0-9_]+/,
                {
                    cases: {
                        '@typeKeywords': 'keyword.type',
                        '@keywords': 'keyword',
                        '@supportConstants': 'keyword',
                        '@supportMacros': 'keyword',
                        '@constants': 'keyword',
                        '@default': 'identifier',
                    }
                }
            ],
            // Designator
            [/\$/, 'identifier'],
            // Lifetime annotations
            [/'[a-zA-Z_][a-zA-Z0-9_]*(?=[^\'])/, 'identifier'],
            // Byte literal
            [/'\S'/, 'string.byteliteral'],
            // Strings
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
            { include: '@numbers' },
            // Whitespace + comments
            { include: '@whitespace' },
            [/@delimiters/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@default': 'delimiter'
                    }
                }],
            [/[{}()\[\]<>]/, '@brackets'],
            [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
        ],
        whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment'],
        ],
        comment: [
            [/[^\/*]+/, 'comment'],
            [/\/\*/, 'comment', '@push'],
            ["\\*/", 'comment', '@pop'],
            [/[\/*]/, 'comment']
        ],
        string: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],
        numbers: [
            //Octal
            [/(0o[0-7_]+)(@intSuffixes)?/, { token: 'number' }],
            //Binary
            [/(0b[0-1_]+)(@intSuffixes)?/, { token: 'number' }],
            //Exponent
            [/[\d][\d_]*(\.[\d][\d_]*)?[eE][+-][\d_]+(@floatSuffixes)?/, { token: 'number' }],
            //Float
            [/\b(\d\.?[\d_]*)(@floatSuffixes)?\b/, { token: 'number' }],
            //Hexadecimal
            [/(0x[\da-fA-F]+)_?(@intSuffixes)?/, { token: 'number' }],
            //Integer
            [/[\d][\d_]*(@intSuffixes?)?/, { token: 'number' }],
        ]
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3J1c3QvcnVzdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDYTtBQUNOO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsV0FBVyxLQUFLO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdEQUF3RDtBQUNqRSxTQUFTLDJDQUEyQztBQUNwRDtBQUNBO0FBQ0EsU0FBUyxTQUFTLFlBQVksR0FBRztBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUNuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0RBQWtEO0FBQ2xEO0FBQ0E7QUFDQTtBQUNBLGtDQUFrQyxFQUFFLElBQUksR0FBRyxJQUFJLEVBQUU7QUFDakQ7QUFDQSxxQ0FBcUM7QUFDckM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQiwyREFBMkQ7QUFDOUUsYUFBYSxzQkFBc0I7QUFDbkM7QUFDQSxhQUFhLHlCQUF5QjtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCLGlCQUFpQjtBQUNqQiwwQkFBMEIsU0FBUywyQ0FBMkMsRUFBRTtBQUNoRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQix5REFBeUQ7QUFDNUU7QUFDQTtBQUNBO0FBQ0EsNENBQTRDLGtCQUFrQjtBQUM5RDtBQUNBLDRDQUE0QyxrQkFBa0I7QUFDOUQ7QUFDQSwwRUFBMEUsa0JBQWtCO0FBQzVGO0FBQ0Esb0RBQW9ELGtCQUFrQjtBQUN0RTtBQUNBLGtEQUFrRCxrQkFBa0I7QUFDcEU7QUFDQSw0Q0FBNEMsa0JBQWtCO0FBQzlEO0FBQ0E7QUFDQSIsImZpbGUiOiI0OC5tYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgY29tbWVudHM6IHtcclxuICAgICAgICBsaW5lQ29tbWVudDogJy8vJyxcclxuICAgICAgICBibG9ja0NvbW1lbnQ6IFsnLyonLCAnKi8nXSxcclxuICAgIH0sXHJcbiAgICBicmFja2V0czogW1xyXG4gICAgICAgIFsneycsICd9J10sXHJcbiAgICAgICAgWydbJywgJ10nXSxcclxuICAgICAgICBbJygnLCAnKSddXHJcbiAgICBdLFxyXG4gICAgYXV0b0Nsb3NpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicsIG5vdEluOiBbJ3N0cmluZyddIH0sXHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgIF0sXHJcbiAgICBmb2xkaW5nOiB7XHJcbiAgICAgICAgbWFya2Vyczoge1xyXG4gICAgICAgICAgICBzdGFydDogbmV3IFJlZ0V4cChcIl5cXFxccyojcHJhZ21hXFxcXHMrcmVnaW9uXFxcXGJcIiksXHJcbiAgICAgICAgICAgIGVuZDogbmV3IFJlZ0V4cChcIl5cXFxccyojcHJhZ21hXFxcXHMrZW5kcmVnaW9uXFxcXGJcIilcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcbmV4cG9ydCB2YXIgbGFuZ3VhZ2UgPSB7XHJcbiAgICB0b2tlblBvc3RmaXg6ICcucnVzdCcsXHJcbiAgICBkZWZhdWx0VG9rZW46ICdpbnZhbGlkJyxcclxuICAgIGtleXdvcmRzOiBbXHJcbiAgICAgICAgJ2FzJywgJ2JveCcsICdicmVhaycsICdjb25zdCcsICdjb250aW51ZScsICdjcmF0ZScsICdlbHNlJywgJ2VudW0nLFxyXG4gICAgICAgICdleHRlcm4nLCAnZmFsc2UnLCAnZm4nLCAnZm9yJywgJ2lmJywgJ2ltcGwnLCAnaW4nLCAnbGV0JywgJ2xvb3AnLFxyXG4gICAgICAgICdtYXRjaCcsICdtb2QnLCAnbW92ZScsICdtdXQnLCAncHViJywgJ3JlZicsICdyZXR1cm4nLCAnc2VsZicsXHJcbiAgICAgICAgJ3N0YXRpYycsICdzdHJ1Y3QnLCAnc3VwZXInLCAndHJhaXQnLCAndHJ1ZScsICd0eXBlJywgJ3Vuc2FmZScsICd1c2UnLFxyXG4gICAgICAgICd3aGVyZScsICd3aGlsZScsICdjYXRjaCcsICdkZWZhdWx0JywgJ3VuaW9uJywgJ3N0YXRpYycsICdhYnN0cmFjdCcsXHJcbiAgICAgICAgJ2FsaWdub2YnLCAnYmVjb21lJywgJ2RvJywgJ2ZpbmFsJywgJ21hY3JvJywgJ29mZnNldG9mJywgJ292ZXJyaWRlJyxcclxuICAgICAgICAncHJpdicsICdwcm9jJywgJ3B1cmUnLCAnc2l6ZW9mJywgJ3R5cGVvZicsICd1bnNpemVkJywgJ3ZpcnR1YWwnLFxyXG4gICAgICAgICd5aWVsZCcsXHJcbiAgICBdLFxyXG4gICAgdHlwZUtleXdvcmRzOiBbXHJcbiAgICAgICAgJ1NlbGYnLCAnbTMyJywgJ202NCcsICdtMTI4JywgJ2Y4MCcsICdmMTYnLCAnZjEyOCcsICdpbnQnLCAndWludCcsXHJcbiAgICAgICAgJ2Zsb2F0JywgJ2NoYXInLCAnYm9vbCcsICd1OCcsICd1MTYnLCAndTMyJywgJ3U2NCcsICdmMzInLCAnZjY0JywgJ2k4JyxcclxuICAgICAgICAnaTE2JywgJ2kzMicsICdpNjQnLCAnc3RyJywgJ09wdGlvbicsICdFaXRoZXInLCAnY19mbG9hdCcsICdjX2RvdWJsZScsXHJcbiAgICAgICAgJ2Nfdm9pZCcsICdGSUxFJywgJ2Zwb3NfdCcsICdESVInLCAnZGlyZW50JywgJ2NfY2hhcicsICdjX3NjaGFyJyxcclxuICAgICAgICAnY191Y2hhcicsICdjX3Nob3J0JywgJ2NfdXNob3J0JywgJ2NfaW50JywgJ2NfdWludCcsICdjX2xvbmcnLFxyXG4gICAgICAgICdjX3Vsb25nJywgJ3NpemVfdCcsICdwdHJkaWZmX3QnLCAnY2xvY2tfdCcsICd0aW1lX3QnLCAnY19sb25nbG9uZycsXHJcbiAgICAgICAgJ2NfdWxvbmdsb25nJywgJ2ludHB0cl90JywgJ3VpbnRwdHJfdCcsICdvZmZfdCcsICdkZXZfdCcsICdpbm9fdCcsXHJcbiAgICAgICAgJ3BpZF90JywgJ21vZGVfdCcsICdzc2l6ZV90JyxcclxuICAgIF0sXHJcbiAgICBjb25zdGFudHM6IFtcclxuICAgICAgICAndHJ1ZScsICdmYWxzZScsICdTb21lJywgJ05vbmUnLCAnTGVmdCcsICdSaWdodCcsICdPaycsICdFcnInLFxyXG4gICAgXSxcclxuICAgIHN1cHBvcnRDb25zdGFudHM6IFtcclxuICAgICAgICAnRVhJVF9GQUlMVVJFJywgJ0VYSVRfU1VDQ0VTUycsICdSQU5EX01BWCcsICdFT0YnLCAnU0VFS19TRVQnLFxyXG4gICAgICAgICdTRUVLX0NVUicsICdTRUVLX0VORCcsICdfSU9GQkYnLCAnX0lPTkJGJywgJ19JT0xCRicsICdCVUZTSVonLFxyXG4gICAgICAgICdGT1BFTl9NQVgnLCAnRklMRU5BTUVfTUFYJywgJ0xfdG1wbmFtJywgJ1RNUF9NQVgnLCAnT19SRE9OTFknLFxyXG4gICAgICAgICdPX1dST05MWScsICdPX1JEV1InLCAnT19BUFBFTkQnLCAnT19DUkVBVCcsICdPX0VYQ0wnLCAnT19UUlVOQycsXHJcbiAgICAgICAgJ1NfSUZJRk8nLCAnU19JRkNIUicsICdTX0lGQkxLJywgJ1NfSUZESVInLCAnU19JRlJFRycsICdTX0lGTVQnLFxyXG4gICAgICAgICdTX0lFWEVDJywgJ1NfSVdSSVRFJywgJ1NfSVJFQUQnLCAnU19JUldYVScsICdTX0lYVVNSJywgJ1NfSVdVU1InLFxyXG4gICAgICAgICdTX0lSVVNSJywgJ0ZfT0snLCAnUl9PSycsICdXX09LJywgJ1hfT0snLCAnU1RESU5fRklMRU5PJyxcclxuICAgICAgICAnU1RET1VUX0ZJTEVOTycsICdTVERFUlJfRklMRU5PJyxcclxuICAgIF0sXHJcbiAgICBzdXBwb3J0TWFjcm9zOiBbXHJcbiAgICAgICAgJ2Zvcm1hdCEnLCAncHJpbnQhJywgJ3ByaW50bG4hJywgJ3BhbmljIScsICdmb3JtYXRfYXJncyEnLCAndW5yZWFjaGFibGUhJyxcclxuICAgICAgICAnd3JpdGUhJywgJ3dyaXRlbG4hJ1xyXG4gICAgXSxcclxuICAgIG9wZXJhdG9yczogW1xyXG4gICAgICAgICchJywgJyE9JywgJyUnLCAnJT0nLCAnJicsICcmPScsICcmJicsICcqJywgJyo9JywgJysnLCAnKz0nLCAnLScsICctPScsXHJcbiAgICAgICAgJy0+JywgJy4nLCAnLi4nLCAnLi4uJywgJy8nLCAnLz0nLCAnOicsICc7JywgJzw8JywgJzw8PScsICc8JywgJzw9JywgJz0nLFxyXG4gICAgICAgICc9PScsICc9PicsICc+JywgJz49JywgJz4+JywgJz4+PScsICdAJywgJ14nLCAnXj0nLCAnfCcsICd8PScsICd8fCcsICdfJyxcclxuICAgICAgICAnPycsICcjJ1xyXG4gICAgXSxcclxuICAgIGVzY2FwZXM6IC9cXFxcKFtucnQwXFxcIicnXFxcXF18eFxcaHsyfXx1XFx7XFxoezEsNn1cXH0pLyxcclxuICAgIGRlbGltaXRlcnM6IC9bLF0vLFxyXG4gICAgc3ltYm9sczogL1tcXCNcXCFcXCVcXCZcXCpcXCtcXC1cXC5cXC9cXDpcXDtcXDxcXD1cXD5cXEBcXF5cXHxfXFw/XSsvLFxyXG4gICAgaW50U3VmZml4ZXM6IC9baXVdKDh8MTZ8MzJ8NjR8MTI4fHNpemUpLyxcclxuICAgIGZsb2F0U3VmZml4ZXM6IC9mKDMyfDY0KS8sXHJcbiAgICB0b2tlbml6ZXI6IHtcclxuICAgICAgICByb290OiBbXHJcbiAgICAgICAgICAgIFsvW2EtekEtWl1bYS16QS1aMC05X10qIT98X1thLXpBLVowLTlfXSsvLFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2VzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAdHlwZUtleXdvcmRzJzogJ2tleXdvcmQudHlwZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAa2V5d29yZHMnOiAna2V5d29yZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAc3VwcG9ydENvbnN0YW50cyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BzdXBwb3J0TWFjcm9zJzogJ2tleXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGNvbnN0YW50cyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ2lkZW50aWZpZXInLFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgLy8gRGVzaWduYXRvclxyXG4gICAgICAgICAgICBbL1xcJC8sICdpZGVudGlmaWVyJ10sXHJcbiAgICAgICAgICAgIC8vIExpZmV0aW1lIGFubm90YXRpb25zXHJcbiAgICAgICAgICAgIFsvJ1thLXpBLVpfXVthLXpBLVowLTlfXSooPz1bXlxcJ10pLywgJ2lkZW50aWZpZXInXSxcclxuICAgICAgICAgICAgLy8gQnl0ZSBsaXRlcmFsXHJcbiAgICAgICAgICAgIFsvJ1xcUycvLCAnc3RyaW5nLmJ5dGVsaXRlcmFsJ10sXHJcbiAgICAgICAgICAgIC8vIFN0cmluZ3NcclxuICAgICAgICAgICAgWy9cIi8sIHsgdG9rZW46ICdzdHJpbmcucXVvdGUnLCBicmFja2V0OiAnQG9wZW4nLCBuZXh0OiAnQHN0cmluZycgfV0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BudW1iZXJzJyB9LFxyXG4gICAgICAgICAgICAvLyBXaGl0ZXNwYWNlICsgY29tbWVudHNcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHdoaXRlc3BhY2UnIH0sXHJcbiAgICAgICAgICAgIFsvQGRlbGltaXRlcnMvLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BrZXl3b3Jkcyc6ICdrZXl3b3JkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BkZWZhdWx0JzogJ2RlbGltaXRlcidcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgWy9be30oKVxcW1xcXTw+XS8sICdAYnJhY2tldHMnXSxcclxuICAgICAgICAgICAgWy9Ac3ltYm9scy8sIHsgY2FzZXM6IHsgJ0BvcGVyYXRvcnMnOiAnb3BlcmF0b3InLCAnQGRlZmF1bHQnOiAnJyB9IH1dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2hpdGVzcGFjZTogW1xyXG4gICAgICAgICAgICBbL1sgXFx0XFxyXFxuXSsvLCAnd2hpdGUnXSxcclxuICAgICAgICAgICAgWy9cXC9cXCovLCAnY29tbWVudCcsICdAY29tbWVudCddLFxyXG4gICAgICAgICAgICBbL1xcL1xcLy4qJC8sICdjb21tZW50J10sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBjb21tZW50OiBbXHJcbiAgICAgICAgICAgIFsvW15cXC8qXSsvLCAnY29tbWVudCddLFxyXG4gICAgICAgICAgICBbL1xcL1xcKi8sICdjb21tZW50JywgJ0BwdXNoJ10sXHJcbiAgICAgICAgICAgIFtcIlxcXFwqL1wiLCAnY29tbWVudCcsICdAcG9wJ10sXHJcbiAgICAgICAgICAgIFsvW1xcLypdLywgJ2NvbW1lbnQnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3RyaW5nOiBbXHJcbiAgICAgICAgICAgIFsvW15cXFxcXCJdKy8sICdzdHJpbmcnXSxcclxuICAgICAgICAgICAgWy9AZXNjYXBlcy8sICdzdHJpbmcuZXNjYXBlJ10sXHJcbiAgICAgICAgICAgIFsvXFxcXC4vLCAnc3RyaW5nLmVzY2FwZS5pbnZhbGlkJ10sXHJcbiAgICAgICAgICAgIFsvXCIvLCB7IHRva2VuOiAnc3RyaW5nLnF1b3RlJywgYnJhY2tldDogJ0BjbG9zZScsIG5leHQ6ICdAcG9wJyB9XVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbnVtYmVyczogW1xyXG4gICAgICAgICAgICAvL09jdGFsXHJcbiAgICAgICAgICAgIFsvKDBvWzAtN19dKykoQGludFN1ZmZpeGVzKT8vLCB7IHRva2VuOiAnbnVtYmVyJyB9XSxcclxuICAgICAgICAgICAgLy9CaW5hcnlcclxuICAgICAgICAgICAgWy8oMGJbMC0xX10rKShAaW50U3VmZml4ZXMpPy8sIHsgdG9rZW46ICdudW1iZXInIH1dLFxyXG4gICAgICAgICAgICAvL0V4cG9uZW50XHJcbiAgICAgICAgICAgIFsvW1xcZF1bXFxkX10qKFxcLltcXGRdW1xcZF9dKik/W2VFXVsrLV1bXFxkX10rKEBmbG9hdFN1ZmZpeGVzKT8vLCB7IHRva2VuOiAnbnVtYmVyJyB9XSxcclxuICAgICAgICAgICAgLy9GbG9hdFxyXG4gICAgICAgICAgICBbL1xcYihcXGRcXC4/W1xcZF9dKikoQGZsb2F0U3VmZml4ZXMpP1xcYi8sIHsgdG9rZW46ICdudW1iZXInIH1dLFxyXG4gICAgICAgICAgICAvL0hleGFkZWNpbWFsXHJcbiAgICAgICAgICAgIFsvKDB4W1xcZGEtZkEtRl0rKV8/KEBpbnRTdWZmaXhlcyk/LywgeyB0b2tlbjogJ251bWJlcicgfV0sXHJcbiAgICAgICAgICAgIC8vSW50ZWdlclxyXG4gICAgICAgICAgICBbL1tcXGRdW1xcZF9dKihAaW50U3VmZml4ZXM/KT8vLCB7IHRva2VuOiAnbnVtYmVyJyB9XSxcclxuICAgICAgICBdXHJcbiAgICB9XHJcbn07XHJcbiJdLCJzb3VyY2VSb290IjoiIn0=