import { OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CounterParams, Styles } from '@fortawesome/fontawesome-svg-core';
import { FaLayersComponent } from './layers.component';
export declare class FaLayersCounterComponent implements OnChanges {
    private parent;
    private sanitizer;
    content: string;
    title?: string;
    styles?: Styles;
    classes?: string[];
    renderedHTML: SafeHtml;
    constructor(parent: FaLayersComponent, sanitizer: DomSanitizer);
    ngOnChanges(changes: SimpleChanges): void;
    protected buildParams(): CounterParams;
    private updateContent;
}
