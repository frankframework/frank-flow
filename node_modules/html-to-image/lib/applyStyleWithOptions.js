"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function applyStyleWithOptions(clonedNode, options) {
    var style = clonedNode.style;
    if (options.backgroundColor) {
        style.backgroundColor = options.backgroundColor;
    }
    if (options.width) {
        style.width = options.width + "px";
    }
    if (options.height) {
        style.height = options.height + "px";
    }
    if (options.style) {
        Object.assign(style, options.style);
    }
    return clonedNode;
}
exports.default = applyStyleWithOptions;
