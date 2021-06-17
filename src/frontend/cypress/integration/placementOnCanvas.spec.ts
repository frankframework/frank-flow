describe('Placement on canvas', function() {
    before(function() {
        cy.fixture('expectedElements.csv')
        .then(data => createExpectedCanvasElements(data))
        .as('expectedElements');
    });

    it('Each config element is canvas element', function() {
        cy.visit('');
        let expectedElements = this.expectedElements as ExpectedCanvasElement[];
        cy.get('.canvas > app-node').should('have.length', expectedElements.length);
        expectedElements.forEach(element => {
            requestCanvasElementDomObject(element.id).should('exist');
        });
        checkAndGetCanvasElements(expectedElements);
    })
})

function createExpectedCanvasElements(data: string): Array<ExpectedCanvasElement> {
    let result: Array<ExpectedCanvasElement> = new Array<ExpectedCanvasElement>();
    data.split('\n').forEach(s => result.push(new ExpectedCanvasElement(s)));
    return result;
}

class ExpectedCanvasElement {
    id: string;
    x: number;
    y: number;

    constructor(csvLine: string) {
        let fields: Array<string> = csvLine.split(',');
        if(fields.length < 3) {
            throw new Error(`Cannot create ExpectedCanvasElement because line has less than three fields: ${csvLine}`);
        }
        this.id = fields[0];
        this.x = +fields[1];
        this.y = +fields[2];
        if(! Number.isInteger(this.x)) {
            throw new Error(`ExpectedCanvasElement ${this.id} has invalid x-coordinate ${fields[1]}`);
        }
        if(! Number.isInteger(this.y)) {
            throw new Error(`ExpectedCanvasElement ${this.id} has invalid y-coordinate ${fields[2]}`);
        }
    }

    public toString(): string {
        return `ExpectedCanvasElement ${this.id} at (${this.x}, ${this.y})`;
    }
}

function checkAndGetCanvasElements(expected: Array<ExpectedCanvasElement>): Promise<Array<CanvasElement>> {
    let promises: Array<Promise<CanvasElement>> = new Array<Promise<CanvasElement>>();
    expected.forEach(item => promises.push(elementToCanvasElement(item.id)));
    let result = Promise.all(promises);
    result.then(items => {
        cy.log('Have the actual canvas elements in CanvasElement objects:');
        items.forEach(item => cy.log(item.toString()))
    });
    return result;
}

class CanvasElement {
    constructor(
        private left: number,
        private top: number,
        private width: number,
        private height: number) {}

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
    return cy.get(`.canvas > app-node#${name}`);
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
    return {result: new CanvasElement(
        theLeft.result as number, theTop.result as number, theWidth.result as number, theHeight.result as number)};
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
