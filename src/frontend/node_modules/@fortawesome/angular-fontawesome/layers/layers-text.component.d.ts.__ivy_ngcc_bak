import { OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FlipProp, PullProp, RotateProp, SizeProp, Styles, TextParams, Transform } from '@fortawesome/fontawesome-svg-core';
import { FaLayersComponent } from './layers.component';
export declare class FaLayersTextComponent implements OnChanges {
    private parent;
    private sanitizer;
    content: string;
    title?: string;
    styles?: Styles;
    classes?: string[];
    spin?: boolean;
    pulse?: boolean;
    flip?: FlipProp;
    size?: SizeProp;
    pull?: PullProp;
    border?: boolean;
    inverse?: boolean;
    rotate?: RotateProp;
    fixedWidth?: boolean;
    transform?: string | Transform;
    renderedHTML: SafeHtml;
    constructor(parent: FaLayersComponent, sanitizer: DomSanitizer);
    ngOnChanges(changes: SimpleChanges): void;
    /**
     * Updating params by component props.
     */
    protected buildParams(): TextParams;
    private updateContent;
}
