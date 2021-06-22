import { ExpectedCanvasElement } from '../support/expected-canvas-element';
import { CanvasElement } from '../support/canvas-element';

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
      actualElementsValue.forEach((actaulElement) => {
        const expectedElement = expectedElements.get(actaulElement.getId());
        assert(
          actaulElement.getLeft() === expectedElement?.x,
          `x-coordinate match for ${expectedElement?.id}`
        );
        assert(
          actaulElement.getTop() === expectedElement?.y,
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
  const theLeft = checkNumPixelsAndGetAsNumber(left, 'left');
  if (theLeft.error) {
    return { error: theLeft.error };
  }
  const theTop = checkNumPixelsAndGetAsNumber(top, 'top');
  if (theTop.error) {
    return { error: theTop.error };
  }
  const theWidth = checkNumPixelsAndGetAsNumber(width, 'width');
  if (theWidth.error) {
    return { error: theWidth.error };
  }
  const theHeight = checkNumPixelsAndGetAsNumber(height, 'height');
  if (theHeight.error) {
    return { error: theHeight.error };
  }
  return {
    result: new CanvasElement(
      id,
      theLeft.result as number,
      theTop.result as number,
      theWidth.result as number,
      theHeight.result as number
    ),
  };
}

function checkNumPixelsAndGetAsNumber(
  s: string,
  tag: string
): { result?: number; error?: string } {
  if (!s.endsWith('px')) {
    return { error: `${tag} does not end with "px"` };
  }
  const idx = s.indexOf('px');
  const numberString = s.substr(0, idx);
  let v = 0;
  try {
    v = parseInt(numberString, 10);
  } catch (e) {
    return { error: `${tag} does not have a number before "px"` };
  }
  return { result: v };
}
