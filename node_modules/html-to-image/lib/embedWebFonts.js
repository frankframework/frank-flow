"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var embedResources_1 = __importStar(require("./embedResources"));
function parseCSS(source) {
    if (source === undefined) {
        return [];
    }
    var cssText = source;
    var css = [];
    var cssKeyframeRegex = '((@.*?keyframes [\\s\\S]*?){([\\s\\S]*?}\\s*?)})';
    var combinedCSSRegex = '((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]'
        + '*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})'; // to match css & media queries together
    var cssCommentsRegex = new RegExp('(\\/\\*[\\s\\S]*?\\*\\/)', 'gi');
    // strip out comments
    cssText = cssText.replace(cssCommentsRegex, '');
    var keyframesRegex = new RegExp(cssKeyframeRegex, 'gi');
    var arr;
    while (true) {
        arr = keyframesRegex.exec(cssText);
        if (arr === null) {
            break;
        }
        css.push(arr[0]);
    }
    cssText = cssText.replace(keyframesRegex, '');
    // unified regex
    var unified = new RegExp(combinedCSSRegex, 'gi');
    while (true) {
        arr = unified.exec(cssText);
        if (arr === null) {
            break;
        }
        css.push(arr[0]);
    }
    return css;
}
function fetchCSS(url, sheet) {
    return fetch(url).then(function (res) {
        return {
            url: url,
            cssText: res.text(),
        };
    }, function (e) {
        console.log('ERROR FETCHING CSS: ', e.toString());
    });
}
function embedFonts(data) {
    return data.cssText.then(function (resolved) {
        var cssText = resolved;
        var fontLocations = cssText.match(/url\([^)]+\)/g) || [];
        var fontLoadedPromises = fontLocations.map(function (location) {
            var url = location.replace(/url\(([^]+)\)/g, '$1');
            if (!url.startsWith('https://')) {
                var source = data.url;
                url = new URL(url, source).href;
            }
            return new Promise(function (resolve, reject) {
                fetch(url)
                    .then(function (res) { return res.blob(); })
                    .then(function (blob) {
                    var reader = new FileReader();
                    reader.addEventListener('load', function (res) {
                        // Side Effect
                        cssText = cssText.replace(location, "url(" + reader.result + ")");
                        resolve([location, reader.result]);
                    });
                    reader.readAsDataURL(blob);
                })
                    .catch(reject);
            });
        });
        return Promise.all(fontLoadedPromises).then(function () { return cssText; });
    });
}
function getCssRules(styleSheets) {
    var ret = [];
    var promises = [];
    // First loop inlines imports
    styleSheets.forEach(function (sheet) {
        if ('cssRules' in sheet) {
            try {
                utils_1.toArray(sheet.cssRules).forEach(function (item) {
                    if (item.type === CSSRule.IMPORT_RULE) {
                        promises.push(fetchCSS(item.href, sheet)
                            .then(embedFonts)
                            .then(function (cssText) {
                            var parsed = parseCSS(cssText);
                            parsed.forEach(function (rule) {
                                sheet.insertRule(rule, sheet.cssRules.length);
                            });
                        })
                            .catch(function (e) {
                            console.log('Error loading remote css', e.toString());
                        }));
                    }
                });
            }
            catch (e) {
                var inline_1 = styleSheets.find(function (a) { return a.href === null; }) || document.styleSheets[0];
                if (sheet.href != null) {
                    promises.push(fetchCSS(sheet.href, inline_1)
                        .then(embedFonts)
                        .then(function (cssText) {
                        var parsed = parseCSS(cssText);
                        parsed.forEach(function (rule) {
                            inline_1.insertRule(rule, sheet.cssRules.length);
                        });
                    })
                        .catch(function (e) {
                        console.log('Error loading remote stylesheet', e.toString());
                    }));
                }
                console.log('Error inlining remote css file', e.toString());
            }
        }
    });
    return Promise
        .all(promises)
        .then(function () {
        // Second loop parses rules
        styleSheets.forEach(function (sheet) {
            if ('cssRules' in sheet) {
                try {
                    utils_1.toArray(sheet.cssRules).forEach(function (item) {
                        ret.push(item);
                    });
                }
                catch (e) {
                    console.log("Error while reading CSS rules from " + sheet.href, e.toString());
                }
            }
        });
        return ret;
    });
}
function getWebFontRules(cssRules) {
    return cssRules
        .filter(function (rule) { return rule.type === CSSRule.FONT_FACE_RULE; })
        .filter(function (rule) { return embedResources_1.shouldEmbed(rule.style.getPropertyValue('src')); });
}
function parseWebFontRules(clonedNode) {
    return new Promise(function (resolve, reject) {
        if (!clonedNode.ownerDocument) {
            reject(new Error('Provided element is not within a Document'));
        }
        resolve(utils_1.toArray(clonedNode.ownerDocument.styleSheets));
    })
        .then(getCssRules)
        .then(getWebFontRules);
}
exports.parseWebFontRules = parseWebFontRules;
function embedWebFonts(clonedNode, options) {
    return parseWebFontRules(clonedNode)
        .then(function (rules) { return Promise.all(rules.map(function (rule) {
        var baseUrl = rule.parentStyleSheet ? rule.parentStyleSheet.href : null;
        return embedResources_1.default(rule.cssText, baseUrl, options);
    })); })
        .then(function (cssStrings) { return cssStrings.join('\n'); })
        .then(function (cssString) {
        var styleNode = document.createElement('style');
        var sytleContent = document.createTextNode(cssString);
        styleNode.appendChild(sytleContent);
        if (clonedNode.firstChild) {
            clonedNode.insertBefore(styleNode, clonedNode.firstChild);
        }
        else {
            clonedNode.appendChild(styleNode);
        }
        return clonedNode;
    });
}
exports.default = embedWebFonts;
