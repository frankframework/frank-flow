import * as cypress from "cypress";
import { reject } from "cypress/types/bluebird";

describe('Placement on canvas', function() {
    it('Each config element is canvas element', function() {
        cy.visit('');
        elementToCanvasElement('FirstPipe').then(c => cy.log(c.toString()));
    })
})

class CanvasElement {
    left: number;
    top: number;
    width: number;
    height: number;

    constructor(left: number, top: number, width: number, height: number) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
    }

    toString() {
        return `CanvasElement(${this.left}, ${this.top}, ${this.width}, ${this.height})`;
    }
}

function elementToCanvasElement(inputElementName: string): Promise<CanvasElement> {
    return new Promise<CanvasElement>((resolve, reject) => {
        requestCanvasElementDomObject(inputElementName).invoke('css', 'left').then(left => {
            requestCanvasElementDomObject(inputElementName).invoke('css', 'top').then(top => {
                requestCanvasElementDomObject(inputElementName).invoke('css', 'min-width').then(width => {
                    requestCanvasElementDomObject(inputElementName).invoke('css', 'min-height').then(height => {
                        let result = createCanvasElement(left as unknown as string, top as unknown as string, width as unknown as string, height as unknown as string);
                        if(result.error) {
                            reject(result.error);
                        } else {
                            resolve(result.result as CanvasElement);
                        }
                    });
                });
            });
        });
    });
}

function requestCanvasElementDomObject(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('.canvas > app-node#FirstPipe')
}

function createCanvasElement(left:string, top: string, width: string, height: string)
:{result ?: CanvasElement, error?: string} {
    let theLeft = checkNumPixelsAndGetAsNumber(left, 'left');
    if(theLeft.error) {
        return {error: theLeft.error};
    }
    let theTop = checkNumPixelsAndGetAsNumber(top, 'top');
    if(theTop.error) {
        return {error: theTop.error};
    }
    let theWidth = checkNumPixelsAndGetAsNumber(width, 'width');
    if(theWidth.error) {
        return {error: theWidth.error};
    }
    let theHeight = checkNumPixelsAndGetAsNumber(height, 'height');
    if(theHeight.error) {
        return {error: theHeight.error};
    }
    return {result: new CanvasElement(theLeft.result as number, theTop.result, theWidth.result, theHeight.result)};
}

function checkNumPixelsAndGetAsNumber(s: string, tag: string)
: {result ?: number, error ?: string} {
    if(! s.endsWith('px')) {
        return {error: `${tag} does not end with "px"`};
    }
    let idx = s.indexOf('px');
    let numberString = s.substr(0, idx);
    let v = 0;
    try {
        v = parseInt(numberString);
    } catch(e) {
        return {error: `${tag} does not have a number before "px"`};
    }
    return {result: v};
}
