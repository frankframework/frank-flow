"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var cloneNode_1 = __importDefault(require("./cloneNode"));
var embedWebFonts_1 = __importDefault(require("./embedWebFonts"));
var embedImages_1 = __importDefault(require("./embedImages"));
var createSvgDataURL_1 = __importDefault(require("./createSvgDataURL"));
var applyStyleWithOptions_1 = __importDefault(require("./applyStyleWithOptions"));
var utils_1 = require("./utils");
function getImageSize(domNode, options) {
    if (options === void 0) { options = {}; }
    var width = options.width || utils_1.getNodeWidth(domNode);
    var height = options.height || utils_1.getNodeHeight(domNode);
    return { width: width, height: height };
}
function toSvgDataURL(domNode, options) {
    if (options === void 0) { options = {}; }
    var _a = getImageSize(domNode, options), width = _a.width, height = _a.height;
    return cloneNode_1.default(domNode, options.filter, true)
        .then(function (clonedNode) { return embedWebFonts_1.default(clonedNode, options); })
        .then(function (clonedNode) { return embedImages_1.default(clonedNode, options); })
        .then(function (clonedNode) { return applyStyleWithOptions_1.default(clonedNode, options); })
        .then(function (clonedNode) { return createSvgDataURL_1.default(clonedNode, width, height); });
}
exports.toSvgDataURL = toSvgDataURL;
function toCanvas(domNode, options) {
    if (options === void 0) { options = {}; }
    return toSvgDataURL(domNode, options)
        .then(utils_1.createImage)
        .then(utils_1.delay(100))
        .then(function (image) {
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        var ratio = utils_1.getPixelRatio();
        var _a = getImageSize(domNode, options), width = _a.width, height = _a.height;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = "" + width;
        canvas.style.height = "" + height;
        context.scale(ratio, ratio);
        if (options.backgroundColor) {
            context.fillStyle = options.backgroundColor;
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0);
        return canvas;
    });
}
exports.toCanvas = toCanvas;
function toPixelData(domNode, options) {
    if (options === void 0) { options = {}; }
    var _a = getImageSize(domNode, options), width = _a.width, height = _a.height;
    return toCanvas(domNode, options)
        .then(function (canvas) { return (canvas.getContext('2d').getImageData(0, 0, width, height).data); });
}
exports.toPixelData = toPixelData;
function toPng(domNode, options) {
    if (options === void 0) { options = {}; }
    return toCanvas(domNode, options).then(function (canvas) { return (canvas.toDataURL()); });
}
exports.toPng = toPng;
function toJpeg(domNode, options) {
    if (options === void 0) { options = {}; }
    return toCanvas(domNode, options).then(function (canvas) { return (canvas.toDataURL('image/jpeg', options.quality || 1)); });
}
exports.toJpeg = toJpeg;
function toBlob(domNode, options) {
    if (options === void 0) { options = {}; }
    return toCanvas(domNode, options).then(utils_1.canvasToBlob);
}
exports.toBlob = toBlob;
exports.default = {
    toSvgDataURL: toSvgDataURL,
    toCanvas: toCanvas,
    toPixelData: toPixelData,
    toPng: toPng,
    toJpeg: toJpeg,
    toBlob: toBlob,
};
