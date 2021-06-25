import { ExpectedCanvasNode } from '../support/expected-canvas-node';
import { CanvasNode } from '../support/canvas-node';
import { ParsedNumPixels } from '../support/parsed-num-pixels';
import { CanvasConnectionArea } from '../support/canvas-connection-area';

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
      ExpectedCanvasNode
    >;
    cy.get('.canvas > app-node').should('have.length', expectedElements.size);
    expectedElements.forEach((element) => {
      requestCanvasNodeDomObject(element.id).should('exist');
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
    requestCanvasConnectionAreas(2 * expectedElements.size).then((areas) => {
      areas.forEach((area) => cy.log(area.toString()));
    });
  });
});

function createExpectedCanvasElements(
  data: string
): Map<string, ExpectedCanvasNode> {
  const result = new Map<string, ExpectedCanvasNode>();
  data.split('\n').forEach((s) => {
    const newExpectedCanvasElement = new ExpectedCanvasNode(s);
    result.set(newExpectedCanvasElement.id, newExpectedCanvasElement);
  });
  return result;
}

function checkAndGetCanvasElements(
  expected: Array<ExpectedCanvasNode>
): Promise<Array<CanvasNode>> {
  const promises: Array<Promise<CanvasNode>> = new Array<Promise<CanvasNode>>();
  expected.forEach((item) => promises.push(elementToCanvasNode(item.id)));
  const result = Promise.all(promises);
  result.then((items) => {
    cy.log('Have the actual canvas elements in CanvasElement objects:');
    items.forEach((item) => cy.log(item.toString()));
  });
  return result;
}

function elementToCanvasNode(inputElementName: string): Promise<CanvasNode> {
  return new Promise<CanvasNode>((resolve, reject) => {
    requestCanvasNodeDomObject(inputElementName).then((domObject) => {
      const left = domObject.css('left');
      const top = domObject.css('top');
      const width = domObject.css('min-width');
      const height = domObject.css('min-height');
      const result = createCanvasNode(
        inputElementName,
        (left as unknown) as string,
        (top as unknown) as string,
        (width as unknown) as string,
        (height as unknown) as string
      );
      if (result.error) {
        reject(result.error);
      } else {
        resolve(result.result as CanvasNode);
      }
    });
  });
}

function requestCanvasNodeDomObject(
  name: string
): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get(`.canvas > app-node#${name}`);
}

function createCanvasNode(
  id: string,
  left: string,
  top: string,
  width: string,
  height: string
): { result?: CanvasNode; error?: string } {
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
    result: new CanvasNode(
      id,
      theLeft.theNumber,
      theTop.theNumber,
      theWidth.theNumber,
      theHeight.theNumber
    ),
  };
}

function requestCanvasConnectionAreas(
  numConnectionPoints: number
): Promise<CanvasConnectionArea[]> {
  requestCanvasConnectionAreasDomObject().should(
    'have.length',
    numConnectionPoints
  );
  let result = new Array<Promise<CanvasConnectionArea>>();
  let current = requestCanvasConnectionAreasDomObject().first();
  for (let i = 0; i < numConnectionPoints; ++i) {
    result.push(requestCanvasConnectionArea(current));
    current = current.next();
  }
  return Promise.all(result);
}

function requestCanvasConnectionAreasDomObject(): Cypress.Chainable<
  JQuery<HTMLElement>
> {
  return cy.get('.canvas > .jtk-endpoint');
}

function requestCanvasConnectionArea(
  chainableDomObject: Cypress.Chainable<JQuery<HTMLElement>>
): Promise<CanvasConnectionArea> {
  return new Promise((resolve, reject) => {
    chainableDomObject.then((domObject) => {
      const left = domObject.css('left');
      const top = domObject.css('top');
      const width = domObject.css('width');
      const height = domObject.css('height');
      const result = createCanvasConnectionArea(
        (left as unknown) as string,
        (top as unknown) as string,
        (width as unknown) as string,
        (height as unknown) as string
      );
      if (result.error) {
        reject(result.error);
      } else {
        resolve(result.result as CanvasConnectionArea);
      }
    });
  });
}

function createCanvasConnectionArea(
  left: string,
  top: string,
  width: string,
  height: string
): { result?: CanvasConnectionArea; error?: string } {
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
    result: new CanvasConnectionArea(
      theLeft.theNumber,
      theTop.theNumber,
      theWidth.theNumber,
      theHeight.theNumber
    ),
  };
}
