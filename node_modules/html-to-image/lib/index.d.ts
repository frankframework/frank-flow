export declare type OptionsType = {
    /**
     * A function taking DOM node as argument. Should return `true`
     * if passed node should be included in the output. Excluding
     * node means excluding it's children as well.
    */
    filter?: (domNode: HTMLElement) => boolean;
    width?: number;
    height?: number;
    style?: Object;
    /**
     * A number between `0` and `1` indicating image quality (e.g. 0.92 => 92%)
     * of the JPEG image.
    */
    quality?: number;
    /**
     * A string value for the background color, any valid CSS color value.
    */
    backgroundColor?: string;
    /**
     * Set to `true` to append the current time as a query string to URL
     * requests to enable cache busting.
    */
    cacheBust?: boolean;
    /**
     * A data URL for a placeholder image that will be used when fetching
     * an image fails. Defaults to an empty string and will render empty
     * areas for failed images.
    */
    imagePlaceholder?: string;
};
export declare function toSvgDataURL(domNode: HTMLElement, options?: OptionsType): Promise<string>;
export declare function toCanvas(domNode: HTMLElement, options?: OptionsType): Promise<HTMLCanvasElement>;
export declare function toPixelData(domNode: HTMLElement, options?: OptionsType): Promise<Uint8ClampedArray>;
export declare function toPng(domNode: HTMLElement, options?: OptionsType): Promise<string>;
export declare function toJpeg(domNode: HTMLElement, options?: OptionsType): Promise<string>;
export declare function toBlob(domNode: HTMLElement, options?: OptionsType): Promise<Blob | null>;
declare const _default: {
    toSvgDataURL: typeof toSvgDataURL;
    toCanvas: typeof toCanvas;
    toPixelData: typeof toPixelData;
    toPng: typeof toPng;
    toJpeg: typeof toJpeg;
    toBlob: typeof toBlob;
};
export default _default;
