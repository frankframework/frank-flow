import { ExpectedCanvasElement } from '../support/expected-canvas-element';
import { CanvasElement } from '../support/canvas-element';
import { ParsedNumPixels } from '../support/parsed-num-pixels';

describe('Placement on canvas', () => {
  before(() => {
    cy.fixture('expectedElements.csv')
      .then((data) => createExpectedCanvasElements(data))
      .as('expectedElements');
  });

  it('Each config element is canvas element', function (): void {
    cy.visit('');
    const expectedElements = this.expectedElements as Map<
      string,
      ExpectedCanvasElement
    >;
    cy.get('.canvas > app-node').should('have.length', expectedElements.size);
    expectedElements.forEach((element) => {
      requestCanvasElementDomObject(element.id).should('exist');
    });
    const actualElements = checkAndGetCanvasElements([
      ...expectedElements.values(),
    ]);
    actualElements.then((actualElementsValue) =>
      actualElementsValue.forEach((actualElement) => {
        const expectedElement = expectedElements.get(actualElement.getId());
        assert(
          actualElement.getLeft() === expectedElement?.x,
          `x-coordinate match for ${expectedElement?.id}`
        );
        assert(
          actualElement.getTop() === expectedElement?.y,
          `y-coordinate match for ${expectedElement?.id}`
        );
      })
    );
  });
});

function createExpectedCanvasElements(
  data: string
): Map<string, ExpectedCanvasElement> {
  const result = new Map<string, ExpectedCanvasElement>();
  data.split('\n').forEach((s) => {
    const newExpectedCanvasElement = new ExpectedCanvasElement(s);
    result.set(newExpectedCanvasElement.id, newExpectedCanvasElement);
  });
  return result;
}

function checkAndGetCanvasElements(
  expected: Array<ExpectedCanvasElement>
): Promise<Array<CanvasElement>> {
  const promises: Array<Promise<CanvasElement>> = new Array<
    Promise<CanvasElement>
  >();
  expected.forEach((item) => promises.push(elementToCanvasElement(item.id)));
  const result = Promise.all(promises);
  result.then((items) => {
    cy.log('Have the actual canvas elements in CanvasElement objects:');
    items.forEach((item) => cy.log(item.toString()));
  });
  return result;
}

function elementToCanvasElement(
  inputElementName: string
): Promise<CanvasElement> {
  return new Promise<CanvasElement>((resolve, reject) => {
    requestCanvasElementDomObject(inputElementName)
      .invoke('css', 'left')
      .then((left) => {
        requestCanvasElementDomObject(inputElementName)
          .invoke('css', 'top')
          .then((top) => {
            requestCanvasElementDomObject(inputElementName)
              .invoke('css', 'min-width')
              .then((width) => {
                requestCanvasElementDomObject(inputElementName)
                  .invoke('css', 'min-height')
                  .then((height) => {
                    const result = createCanvasElement(
                      inputElementName,
                      (left as unknown) as string,
                      (top as unknown) as string,
                      (width as unknown) as string,
                      (height as unknown) as string
                    );
                    if (result.error) {
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

function requestCanvasElementDomObject(
  name: string
): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get(`.canvas > app-node#${name}`);
}

function createCanvasElement(
  id: string,
  left: string,
  top: string,
  width: string,
  height: string
): { result?: CanvasElement; error?: string } {
  const theLeft = new ParsedNumPixels(left, 'left');
  if (!theLeft.hasNumber) {
    return { error: theLeft.error };
  }
  const theTop = new ParsedNumPixels(top, 'top');
  if (!theTop.hasNumber) {
    return { error: theTop.error };
  }
  const theWidth = new ParsedNumPixels(width, 'width');
  if (!theWidth.hasNumber) {
    return { error: theWidth.error };
  }
  const theHeight = new ParsedNumPixels(height, 'height');
  if (!theHeight.hasNumber) {
    return { error: theHeight.error };
  }
  return {
    result: new CanvasElement(
      id,
      theLeft.theNumber,
      theTop.theNumber,
      theWidth.theNumber,
      theHeight.theNumber
    ),
  };
}
