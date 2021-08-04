import '../jqwidgets/jqxcore';
import '../jqwidgets/jqxheatmap';
import * as tslib_1 from "tslib";
import { NgModule } from '@angular/core';
import { jqxHeatMapComponent } from './angular_jqxheatmap';
var jqxHeatMapModule = /** @class */ (function () {
    function jqxHeatMapModule() {
    }
    jqxHeatMapModule = tslib_1.__decorate([
        NgModule({
            imports: [],
            declarations: [jqxHeatMapComponent],
            exports: [jqxHeatMapComponent]
        })
    ], jqxHeatMapModule);
    return jqxHeatMapModule;
}());
export { jqxHeatMapModule };
