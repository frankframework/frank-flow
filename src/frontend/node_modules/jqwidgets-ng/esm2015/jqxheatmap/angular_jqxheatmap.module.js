import '../jqwidgets/jqxcore';
import '../jqwidgets/jqxheatmap';
import * as tslib_1 from "tslib";
import { NgModule } from '@angular/core';
import { jqxHeatMapComponent } from './angular_jqxheatmap';
let jqxHeatMapModule = class jqxHeatMapModule {
};
jqxHeatMapModule = tslib_1.__decorate([
    NgModule({
        imports: [],
        declarations: [jqxHeatMapComponent],
        exports: [jqxHeatMapComponent]
    })
], jqxHeatMapModule);
export { jqxHeatMapModule };
