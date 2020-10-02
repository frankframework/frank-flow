(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[44],{

/***/ "./node_modules/monaco-editor/esm/vs/basic-languages/redis/redis.js":
/*!**************************************************************************!*\
  !*** ./node_modules/monaco-editor/esm/vs/basic-languages/redis/redis.js ***!
  \**************************************************************************/
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
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
    ]
};
var language = {
    defaultToken: '',
    tokenPostfix: '.redis',
    ignoreCase: true,
    brackets: [
        { open: '[', close: ']', token: 'delimiter.square' },
        { open: '(', close: ')', token: 'delimiter.parenthesis' }
    ],
    keywords: [
        "APPEND", "AUTH", "BGREWRITEAOF", "BGSAVE", "BITCOUNT", "BITFIELD", "BITOP", "BITPOS", "BLPOP", "BRPOP", "BRPOPLPUSH",
        "CLIENT", "KILL", "LIST", "GETNAME", "PAUSE", "REPLY", "SETNAME", "CLUSTER", "ADDSLOTS", "COUNT-FAILURE-REPORTS",
        "COUNTKEYSINSLOT", "DELSLOTS", "FAILOVER", "FORGET", "GETKEYSINSLOT", "INFO", "KEYSLOT", "MEET", "NODES", "REPLICATE",
        "RESET", "SAVECONFIG", "SET-CONFIG-EPOCH", "SETSLOT", "SLAVES", "SLOTS", "COMMAND", "COUNT", "GETKEYS", "CONFIG", "GET",
        "REWRITE", "SET", "RESETSTAT", "DBSIZE", "DEBUG", "OBJECT", "SEGFAULT", "DECR", "DECRBY", "DEL", "DISCARD", "DUMP", "ECHO",
        "EVAL", "EVALSHA", "EXEC", "EXISTS", "EXPIRE", "EXPIREAT", "FLUSHALL", "FLUSHDB", "GEOADD", "GEOHASH", "GEOPOS", "GEODIST",
        "GEORADIUS", "GEORADIUSBYMEMBER", "GETBIT", "GETRANGE", "GETSET", "HDEL", "HEXISTS", "HGET", "HGETALL", "HINCRBY", "HINCRBYFLOAT",
        "HKEYS", "HLEN", "HMGET", "HMSET", "HSET", "HSETNX", "HSTRLEN", "HVALS", "INCR", "INCRBY", "INCRBYFLOAT", "KEYS", "LASTSAVE",
        "LINDEX", "LINSERT", "LLEN", "LPOP", "LPUSH", "LPUSHX", "LRANGE", "LREM", "LSET", "LTRIM", "MGET", "MIGRATE", "MONITOR",
        "MOVE", "MSET", "MSETNX", "MULTI", "PERSIST", "PEXPIRE", "PEXPIREAT", "PFADD", "PFCOUNT", "PFMERGE", "PING", "PSETEX",
        "PSUBSCRIBE", "PUBSUB", "PTTL", "PUBLISH", "PUNSUBSCRIBE", "QUIT", "RANDOMKEY", "READONLY", "READWRITE", "RENAME", "RENAMENX",
        "RESTORE", "ROLE", "RPOP", "RPOPLPUSH", "RPUSH", "RPUSHX", "SADD", "SAVE", "SCARD", "SCRIPT", "FLUSH", "LOAD", "SDIFF",
        "SDIFFSTORE", "SELECT", "SETBIT", "SETEX", "SETNX", "SETRANGE", "SHUTDOWN", "SINTER", "SINTERSTORE", "SISMEMBER", "SLAVEOF",
        "SLOWLOG", "SMEMBERS", "SMOVE", "SORT", "SPOP", "SRANDMEMBER", "SREM", "STRLEN", "SUBSCRIBE", "SUNION", "SUNIONSTORE", "SWAPDB",
        "SYNC", "TIME", "TOUCH", "TTL", "TYPE", "UNSUBSCRIBE", "UNLINK", "UNWATCH", "WAIT", "WATCH", "ZADD", "ZCARD", "ZCOUNT", "ZINCRBY",
        "ZINTERSTORE", "ZLEXCOUNT", "ZRANGE", "ZRANGEBYLEX", "ZREVRANGEBYLEX", "ZRANGEBYSCORE", "ZRANK", "ZREM", "ZREMRANGEBYLEX",
        "ZREMRANGEBYRANK", "ZREMRANGEBYSCORE", "ZREVRANGE", "ZREVRANGEBYSCORE", "ZREVRANK", "ZSCORE", "ZUNIONSTORE", "SCAN", "SSCAN",
        "HSCAN", "ZSCAN"
    ],
    operators: [
    // NOT SUPPORTED
    ],
    builtinFunctions: [
    // NOT SUPPORTED
    ],
    builtinVariables: [
    // NOT SUPPORTED
    ],
    pseudoColumns: [
    // NOT SUPPORTED
    ],
    tokenizer: {
        root: [
            { include: '@whitespace' },
            { include: '@pseudoColumns' },
            { include: '@numbers' },
            { include: '@strings' },
            { include: '@scopes' },
            [/[;,.]/, 'delimiter'],
            [/[()]/, '@brackets'],
            [/[\w@#$]+/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@operators': 'operator',
                        '@builtinVariables': 'predefined',
                        '@builtinFunctions': 'predefined',
                        '@default': 'identifier'
                    }
                }],
            [/[<>=!%&+\-*/|~^]/, 'operator'],
        ],
        whitespace: [
            [/\s+/, 'white']
        ],
        pseudoColumns: [
            [/[$][A-Za-z_][\w@#$]*/, {
                    cases: {
                        '@pseudoColumns': 'predefined',
                        '@default': 'identifier'
                    }
                }],
        ],
        numbers: [
            [/0[xX][0-9a-fA-F]*/, 'number'],
            [/[$][+-]*\d*(\.\d*)?/, 'number'],
            [/((\d+(\.\d*)?)|(\.\d+))([eE][\-+]?\d+)?/, 'number']
        ],
        strings: [
            [/'/, { token: 'string', next: '@string' }],
            [/"/, { token: 'string.double', next: '@stringDouble' }]
        ],
        string: [
            [/[^']+/, 'string'],
            [/''/, 'string'],
            [/'/, { token: 'string', next: '@pop' }],
        ],
        stringDouble: [
            [/[^"]+/, 'string.double'],
            [/""/, 'string.double'],
            [/"/, { token: 'string.double', next: '@pop' }]
        ],
        scopes: [
        // NOT SUPPORTED
        ]
    }
};


/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvci9lc20vdnMvYmFzaWMtbGFuZ3VhZ2VzL3JlZGlzL3JlZGlzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNhO0FBQ047QUFDUDtBQUNBLFdBQVcsS0FBSztBQUNoQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMsU0FBUyxZQUFZLEdBQUc7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkM7QUFDQTtBQUNBLFNBQVMsU0FBUyxZQUFZLEdBQUc7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkM7QUFDQTtBQUNPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLG1EQUFtRDtBQUM1RCxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWEseUJBQXlCO0FBQ3RDLGFBQWEsNEJBQTRCO0FBQ3pDLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEsc0JBQXNCO0FBQ25DLGFBQWEscUJBQXFCO0FBQ2xDLGdCQUFnQjtBQUNoQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQixtQ0FBbUM7QUFDdEQsbUJBQW1CLGdEQUFnRDtBQUNuRTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQixnQ0FBZ0M7QUFDbkQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsdUNBQXVDO0FBQzFEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiI0NC5tYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxyXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cclxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcbid1c2Ugc3RyaWN0JztcclxuZXhwb3J0IHZhciBjb25mID0ge1xyXG4gICAgYnJhY2tldHM6IFtcclxuICAgICAgICBbJ3snLCAnfSddLFxyXG4gICAgICAgIFsnWycsICddJ10sXHJcbiAgICAgICAgWycoJywgJyknXVxyXG4gICAgXSxcclxuICAgIGF1dG9DbG9zaW5nUGFpcnM6IFtcclxuICAgICAgICB7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcclxuICAgICAgICB7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnIH0sXHJcbiAgICBdLFxyXG4gICAgc3Vycm91bmRpbmdQYWlyczogW1xyXG4gICAgICAgIHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxyXG4gICAgICAgIHsgb3BlbjogJ1wiJywgY2xvc2U6ICdcIicgfSxcclxuICAgICAgICB7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycgfSxcclxuICAgIF1cclxufTtcclxuZXhwb3J0IHZhciBsYW5ndWFnZSA9IHtcclxuICAgIGRlZmF1bHRUb2tlbjogJycsXHJcbiAgICB0b2tlblBvc3RmaXg6ICcucmVkaXMnLFxyXG4gICAgaWdub3JlQ2FzZTogdHJ1ZSxcclxuICAgIGJyYWNrZXRzOiBbXHJcbiAgICAgICAgeyBvcGVuOiAnWycsIGNsb3NlOiAnXScsIHRva2VuOiAnZGVsaW1pdGVyLnNxdWFyZScgfSxcclxuICAgICAgICB7IG9wZW46ICcoJywgY2xvc2U6ICcpJywgdG9rZW46ICdkZWxpbWl0ZXIucGFyZW50aGVzaXMnIH1cclxuICAgIF0sXHJcbiAgICBrZXl3b3JkczogW1xyXG4gICAgICAgIFwiQVBQRU5EXCIsIFwiQVVUSFwiLCBcIkJHUkVXUklURUFPRlwiLCBcIkJHU0FWRVwiLCBcIkJJVENPVU5UXCIsIFwiQklURklFTERcIiwgXCJCSVRPUFwiLCBcIkJJVFBPU1wiLCBcIkJMUE9QXCIsIFwiQlJQT1BcIiwgXCJCUlBPUExQVVNIXCIsXHJcbiAgICAgICAgXCJDTElFTlRcIiwgXCJLSUxMXCIsIFwiTElTVFwiLCBcIkdFVE5BTUVcIiwgXCJQQVVTRVwiLCBcIlJFUExZXCIsIFwiU0VUTkFNRVwiLCBcIkNMVVNURVJcIiwgXCJBRERTTE9UU1wiLCBcIkNPVU5ULUZBSUxVUkUtUkVQT1JUU1wiLFxyXG4gICAgICAgIFwiQ09VTlRLRVlTSU5TTE9UXCIsIFwiREVMU0xPVFNcIiwgXCJGQUlMT1ZFUlwiLCBcIkZPUkdFVFwiLCBcIkdFVEtFWVNJTlNMT1RcIiwgXCJJTkZPXCIsIFwiS0VZU0xPVFwiLCBcIk1FRVRcIiwgXCJOT0RFU1wiLCBcIlJFUExJQ0FURVwiLFxyXG4gICAgICAgIFwiUkVTRVRcIiwgXCJTQVZFQ09ORklHXCIsIFwiU0VULUNPTkZJRy1FUE9DSFwiLCBcIlNFVFNMT1RcIiwgXCJTTEFWRVNcIiwgXCJTTE9UU1wiLCBcIkNPTU1BTkRcIiwgXCJDT1VOVFwiLCBcIkdFVEtFWVNcIiwgXCJDT05GSUdcIiwgXCJHRVRcIixcclxuICAgICAgICBcIlJFV1JJVEVcIiwgXCJTRVRcIiwgXCJSRVNFVFNUQVRcIiwgXCJEQlNJWkVcIiwgXCJERUJVR1wiLCBcIk9CSkVDVFwiLCBcIlNFR0ZBVUxUXCIsIFwiREVDUlwiLCBcIkRFQ1JCWVwiLCBcIkRFTFwiLCBcIkRJU0NBUkRcIiwgXCJEVU1QXCIsIFwiRUNIT1wiLFxyXG4gICAgICAgIFwiRVZBTFwiLCBcIkVWQUxTSEFcIiwgXCJFWEVDXCIsIFwiRVhJU1RTXCIsIFwiRVhQSVJFXCIsIFwiRVhQSVJFQVRcIiwgXCJGTFVTSEFMTFwiLCBcIkZMVVNIREJcIiwgXCJHRU9BRERcIiwgXCJHRU9IQVNIXCIsIFwiR0VPUE9TXCIsIFwiR0VPRElTVFwiLFxyXG4gICAgICAgIFwiR0VPUkFESVVTXCIsIFwiR0VPUkFESVVTQllNRU1CRVJcIiwgXCJHRVRCSVRcIiwgXCJHRVRSQU5HRVwiLCBcIkdFVFNFVFwiLCBcIkhERUxcIiwgXCJIRVhJU1RTXCIsIFwiSEdFVFwiLCBcIkhHRVRBTExcIiwgXCJISU5DUkJZXCIsIFwiSElOQ1JCWUZMT0FUXCIsXHJcbiAgICAgICAgXCJIS0VZU1wiLCBcIkhMRU5cIiwgXCJITUdFVFwiLCBcIkhNU0VUXCIsIFwiSFNFVFwiLCBcIkhTRVROWFwiLCBcIkhTVFJMRU5cIiwgXCJIVkFMU1wiLCBcIklOQ1JcIiwgXCJJTkNSQllcIiwgXCJJTkNSQllGTE9BVFwiLCBcIktFWVNcIiwgXCJMQVNUU0FWRVwiLFxyXG4gICAgICAgIFwiTElOREVYXCIsIFwiTElOU0VSVFwiLCBcIkxMRU5cIiwgXCJMUE9QXCIsIFwiTFBVU0hcIiwgXCJMUFVTSFhcIiwgXCJMUkFOR0VcIiwgXCJMUkVNXCIsIFwiTFNFVFwiLCBcIkxUUklNXCIsIFwiTUdFVFwiLCBcIk1JR1JBVEVcIiwgXCJNT05JVE9SXCIsXHJcbiAgICAgICAgXCJNT1ZFXCIsIFwiTVNFVFwiLCBcIk1TRVROWFwiLCBcIk1VTFRJXCIsIFwiUEVSU0lTVFwiLCBcIlBFWFBJUkVcIiwgXCJQRVhQSVJFQVRcIiwgXCJQRkFERFwiLCBcIlBGQ09VTlRcIiwgXCJQRk1FUkdFXCIsIFwiUElOR1wiLCBcIlBTRVRFWFwiLFxyXG4gICAgICAgIFwiUFNVQlNDUklCRVwiLCBcIlBVQlNVQlwiLCBcIlBUVExcIiwgXCJQVUJMSVNIXCIsIFwiUFVOU1VCU0NSSUJFXCIsIFwiUVVJVFwiLCBcIlJBTkRPTUtFWVwiLCBcIlJFQURPTkxZXCIsIFwiUkVBRFdSSVRFXCIsIFwiUkVOQU1FXCIsIFwiUkVOQU1FTlhcIixcclxuICAgICAgICBcIlJFU1RPUkVcIiwgXCJST0xFXCIsIFwiUlBPUFwiLCBcIlJQT1BMUFVTSFwiLCBcIlJQVVNIXCIsIFwiUlBVU0hYXCIsIFwiU0FERFwiLCBcIlNBVkVcIiwgXCJTQ0FSRFwiLCBcIlNDUklQVFwiLCBcIkZMVVNIXCIsIFwiTE9BRFwiLCBcIlNESUZGXCIsXHJcbiAgICAgICAgXCJTRElGRlNUT1JFXCIsIFwiU0VMRUNUXCIsIFwiU0VUQklUXCIsIFwiU0VURVhcIiwgXCJTRVROWFwiLCBcIlNFVFJBTkdFXCIsIFwiU0hVVERPV05cIiwgXCJTSU5URVJcIiwgXCJTSU5URVJTVE9SRVwiLCBcIlNJU01FTUJFUlwiLCBcIlNMQVZFT0ZcIixcclxuICAgICAgICBcIlNMT1dMT0dcIiwgXCJTTUVNQkVSU1wiLCBcIlNNT1ZFXCIsIFwiU09SVFwiLCBcIlNQT1BcIiwgXCJTUkFORE1FTUJFUlwiLCBcIlNSRU1cIiwgXCJTVFJMRU5cIiwgXCJTVUJTQ1JJQkVcIiwgXCJTVU5JT05cIiwgXCJTVU5JT05TVE9SRVwiLCBcIlNXQVBEQlwiLFxyXG4gICAgICAgIFwiU1lOQ1wiLCBcIlRJTUVcIiwgXCJUT1VDSFwiLCBcIlRUTFwiLCBcIlRZUEVcIiwgXCJVTlNVQlNDUklCRVwiLCBcIlVOTElOS1wiLCBcIlVOV0FUQ0hcIiwgXCJXQUlUXCIsIFwiV0FUQ0hcIiwgXCJaQUREXCIsIFwiWkNBUkRcIiwgXCJaQ09VTlRcIiwgXCJaSU5DUkJZXCIsXHJcbiAgICAgICAgXCJaSU5URVJTVE9SRVwiLCBcIlpMRVhDT1VOVFwiLCBcIlpSQU5HRVwiLCBcIlpSQU5HRUJZTEVYXCIsIFwiWlJFVlJBTkdFQllMRVhcIiwgXCJaUkFOR0VCWVNDT1JFXCIsIFwiWlJBTktcIiwgXCJaUkVNXCIsIFwiWlJFTVJBTkdFQllMRVhcIixcclxuICAgICAgICBcIlpSRU1SQU5HRUJZUkFOS1wiLCBcIlpSRU1SQU5HRUJZU0NPUkVcIiwgXCJaUkVWUkFOR0VcIiwgXCJaUkVWUkFOR0VCWVNDT1JFXCIsIFwiWlJFVlJBTktcIiwgXCJaU0NPUkVcIiwgXCJaVU5JT05TVE9SRVwiLCBcIlNDQU5cIiwgXCJTU0NBTlwiLFxyXG4gICAgICAgIFwiSFNDQU5cIiwgXCJaU0NBTlwiXHJcbiAgICBdLFxyXG4gICAgb3BlcmF0b3JzOiBbXHJcbiAgICAvLyBOT1QgU1VQUE9SVEVEXHJcbiAgICBdLFxyXG4gICAgYnVpbHRpbkZ1bmN0aW9uczogW1xyXG4gICAgLy8gTk9UIFNVUFBPUlRFRFxyXG4gICAgXSxcclxuICAgIGJ1aWx0aW5WYXJpYWJsZXM6IFtcclxuICAgIC8vIE5PVCBTVVBQT1JURURcclxuICAgIF0sXHJcbiAgICBwc2V1ZG9Db2x1bW5zOiBbXHJcbiAgICAvLyBOT1QgU1VQUE9SVEVEXHJcbiAgICBdLFxyXG4gICAgdG9rZW5pemVyOiB7XHJcbiAgICAgICAgcm9vdDogW1xyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAd2hpdGVzcGFjZScgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHBzZXVkb0NvbHVtbnMnIH0sXHJcbiAgICAgICAgICAgIHsgaW5jbHVkZTogJ0BudW1iZXJzJyB9LFxyXG4gICAgICAgICAgICB7IGluY2x1ZGU6ICdAc3RyaW5ncycgfSxcclxuICAgICAgICAgICAgeyBpbmNsdWRlOiAnQHNjb3BlcycgfSxcclxuICAgICAgICAgICAgWy9bOywuXS8sICdkZWxpbWl0ZXInXSxcclxuICAgICAgICAgICAgWy9bKCldLywgJ0BicmFja2V0cyddLFxyXG4gICAgICAgICAgICBbL1tcXHdAIyRdKy8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGtleXdvcmRzJzogJ2tleXdvcmQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQG9wZXJhdG9ycyc6ICdvcGVyYXRvcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAYnVpbHRpblZhcmlhYmxlcyc6ICdwcmVkZWZpbmVkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0BidWlsdGluRnVuY3Rpb25zJzogJ3ByZWRlZmluZWQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQGRlZmF1bHQnOiAnaWRlbnRpZmllcidcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgWy9bPD49ISUmK1xcLSovfH5eXS8sICdvcGVyYXRvciddLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2hpdGVzcGFjZTogW1xyXG4gICAgICAgICAgICBbL1xccysvLCAnd2hpdGUnXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcHNldWRvQ29sdW1uczogW1xyXG4gICAgICAgICAgICBbL1skXVtBLVphLXpfXVtcXHdAIyRdKi8sIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQHBzZXVkb0NvbHVtbnMnOiAncHJlZGVmaW5lZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdAZGVmYXVsdCc6ICdpZGVudGlmaWVyJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbnVtYmVyczogW1xyXG4gICAgICAgICAgICBbLzBbeFhdWzAtOWEtZkEtRl0qLywgJ251bWJlciddLFxyXG4gICAgICAgICAgICBbL1skXVsrLV0qXFxkKihcXC5cXGQqKT8vLCAnbnVtYmVyJ10sXHJcbiAgICAgICAgICAgIFsvKChcXGQrKFxcLlxcZCopPyl8KFxcLlxcZCspKShbZUVdW1xcLStdP1xcZCspPy8sICdudW1iZXInXVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3RyaW5nczogW1xyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nJywgbmV4dDogJ0BzdHJpbmcnIH1dLFxyXG4gICAgICAgICAgICBbL1wiLywgeyB0b2tlbjogJ3N0cmluZy5kb3VibGUnLCBuZXh0OiAnQHN0cmluZ0RvdWJsZScgfV1cclxuICAgICAgICBdLFxyXG4gICAgICAgIHN0cmluZzogW1xyXG4gICAgICAgICAgICBbL1teJ10rLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbLycnLywgJ3N0cmluZyddLFxyXG4gICAgICAgICAgICBbLycvLCB7IHRva2VuOiAnc3RyaW5nJywgbmV4dDogJ0Bwb3AnIH1dLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc3RyaW5nRG91YmxlOiBbXHJcbiAgICAgICAgICAgIFsvW15cIl0rLywgJ3N0cmluZy5kb3VibGUnXSxcclxuICAgICAgICAgICAgWy9cIlwiLywgJ3N0cmluZy5kb3VibGUnXSxcclxuICAgICAgICAgICAgWy9cIi8sIHsgdG9rZW46ICdzdHJpbmcuZG91YmxlJywgbmV4dDogJ0Bwb3AnIH1dXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzY29wZXM6IFtcclxuICAgICAgICAvLyBOT1QgU1VQUE9SVEVEXHJcbiAgICAgICAgXVxyXG4gICAgfVxyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IiJ9