import { ExpectedCanvasNode } from '../support/expected-canvas-node';
import { CanvasNode } from '../support/canvas-node';
import { ParsedNumPixels } from '../support/parsed-num-pixels';
import { CanvasConnectionArea } from '../support/canvas-connection-area';
import { ExpectedConnection } from '../support/expected-connection';
import { ParsedPathDProperty } from '../support/parsed-path-d-property';
import { ParsedClassTransformProperty } from '../support/parsed-path-transform-property';
import { CanvasConnection } from 'cypress/support/canvas-connection';
import { ConnectionsOnCanvas } from '../support/connections-on-canvas';
import * as cypress from 'cypress';

describe('Placement on canvas', () => {
  before(() => {
    cy.fixture('expectedElements.csv')
      .then((data) => createExpectedCanvasElements(data))
      .as('expectedElements');
    cy.fixture('expectedConnections.csv')
      .then((data) => createExpectedConnections(data))
      .as('expectedConnections');
    cy.visit('', { timeout: 300000 });
    // TODO: Calculate the number of connections here
    awaitFlowChartConnections(4);
  });

  it('Each config element is canvas element and connections are as expected', function (): void {
    const expectedConnections = this
      .expectedConnections as ExpectedConnection[];
    cy.log('Expected connections are:');
    expectedConnections.forEach((expectedConnection) =>
      cy.log(`  ${expectedConnection.toString()}`)
    );
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
    // We assume that canvas elements have one or two connection points.
    // Pipes have one connection point, while exits and listeners have one.
    // We assume that there is one listener and one exit, and that
    // all other elements are pipes.
    const canvasConnectionAreas = requestCanvasConnectionAreas(
      2 * expectedElements.size - 2
    );
    canvasConnectionAreas.then((areas) => {
      areas.forEach((area) => cy.log(area.toString()));
    });
    const canvasConnections = requestCanvasConnections(
      expectedConnections.length
    );
    canvasConnections
      .then((conn) => {
        cy.log('Have the points that are connected');
        conn.forEach((c) => {
          cy.log(c.toString());
        });
      })
      .catch((e) => expect(e).to.equal(null));
    actualElements
      .then((theActualElements) => {
        canvasConnectionAreas
          .then((theCanvasConnectionAreas) => {
            const connections = new ConnectionsOnCanvas(
              theActualElements,
              theCanvasConnectionAreas
            );
            canvasConnections
              .then((theCanvasConnections) => {
                try {
                  connections.setCanvasConnections(theCanvasConnections);
                  cy.log(
                    'All canvas elements have been parsed. Checking that the nodes are connected as expected'
                  );
                  expect(connections.numConnections()).to.equal(
                    expectedConnections.length
                  );
                  expectedConnections.forEach((expectedConnection) => {
                    expect(
                      connections.hasExpectedConnection(expectedConnection)
                    ).to.be.true;
                  });
                  cy.log('Done checking node connections');
                } catch (e) {
                  expect(e).to.equal(null);
                }
              })
              .catch((e) => expect(e).to.equal(null));
          })
          .catch((e) => expect(e).to.equal(null));
      })
      .catch((e) => expect(e).to.equal(null));
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

function createExpectedConnections(data: string): ExpectedConnection[] {
  const result: ExpectedConnection[] = [];
  data.split('\n').forEach((s) => {
    const endpoints = s.split(',');
    const connection = new ExpectedConnection(endpoints[0], endpoints[1]);
    result.push(connection);
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
      const width = domObject.css('width');
      const height = domObject.css('height');
      const result = createCanvasNode(
        inputElementName,
        left as unknown as string,
        top as unknown as string,
        width as unknown as string,
        height as unknown as string
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
        left as unknown as string,
        top as unknown as string,
        width as unknown as string,
        height as unknown as string
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

function requestCanvasConnections(
  numConnections: number
): Promise<CanvasConnection[]> {
  const promises: Promise<CanvasConnection>[] = [];
  for (let i = 0; i < numConnections; ++i) {
    promises.push(requestCanvasConnection(i));
  }
  return Promise.all(promises);
}

function awaitFlowChartConnections(numConnections: number) {
  cy.get(connectionSearchString, { timeout: 10000 }).should('exist');
  for (let i = 0; i < numConnections; ++i) {
    awaitFlowChartConnectionComplete(i);
  }
}

function awaitFlowChartConnectionComplete(index: number) {
  cy.get(connectionSearchString, { timeout: 10000 }).eq(index).should('exist');
}

function requestCanvasConnection(index: number): Promise<CanvasConnection> {
  return new Promise((resolve, reject) => {
    getCanvasConnectionDomObject(index)
      .invoke('css', 'left')
      .then((left) => {
        getCanvasConnectionDomObject(index)
          .invoke('css', 'top')
          .then((top) => {
            getCanvasConnectionDomObject(index)
              .find('path')
              .first()
              .invoke('css', 'd')
              .then((domD) => {
                getCanvasConnectionDomObject(index)
                  .find('path')
                  .first()
                  .invoke('css', 'transform')
                  .then((domTransform) => {
                    const parsedPropertyD = new ParsedPathDProperty(
                      domD as unknown as string
                    );
                    if (parsedPropertyD.hasError()) {
                      reject(
                        'Property d error: ' + parsedPropertyD.getErrorMsg()
                      );
                      return;
                    }
                    const parsedPropertyTransform =
                      new ParsedClassTransformProperty(
                        domTransform as unknown as string
                      );
                    if (parsedPropertyTransform.hasError()) {
                      reject(
                        'Property transform error: ' +
                          parsedPropertyTransform.getErrorMsg()
                      );
                    }
                    const resultOrError = createCanvasConnection(
                      left as unknown as string,
                      top as unknown as string,
                      parsedPropertyD.getBeginX(),
                      parsedPropertyD.getBeginY(),
                      parsedPropertyD.getEndX(),
                      parsedPropertyD.getEndY(),
                      parsedPropertyTransform.getX(),
                      parsedPropertyTransform.getY()
                    );
                    if (resultOrError.error) {
                      reject(resultOrError.error);
                    } else {
                      resolve(resultOrError.result as CanvasConnection);
                    }
                  });
              });
          });
      });
  });
}

function getCanvasConnectionDomObject(
  index: number
): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get(connectionSearchString).eq(index);
}

function createCanvasConnection(
  left: string,
  top: string,
  beginX: string,
  beginY: string,
  endX: string,
  endY: string,
  transformX: string,
  transformY: string
): { result?: CanvasConnection; error?: string } {
  const theLeft = new ParsedNumPixels(left, 'left');
  if (!theLeft.hasNumber) {
    return { error: theLeft.error };
  }
  const theTop = new ParsedNumPixels(top, 'top');
  if (!theTop.hasNumber) {
    return { error: theTop.error };
  }
  const theBeginX = +beginX;
  if (Number.isNaN(theBeginX)) {
    return { error: `Path begin x is not a number: ${beginX}` };
  }
  const theBeginY = +beginY;
  if (Number.isNaN(theBeginY)) {
    return { error: `Path begin y is not a number: ${beginY}` };
  }
  const theEndX = +endX;
  if (Number.isNaN(theEndX)) {
    return { error: `Path end x is not a number: ${endX}` };
  }
  const theEndY = +endY;
  if (Number.isNaN(theEndY)) {
    return { error: `Path end y is not a number: ${endY}` };
  }
  const theTransformX = +transformX;
  if (Number.isNaN(theTransformX)) {
    return { error: `Transform x is not a number: ${transformX}` };
  }
  const theTransformY = +transformY;
  if (Number.isNaN(theTransformY)) {
    return { error: `Transform y is not a number: ${transformY}` };
  }
  const connection = new CanvasConnection(
    theLeft.theNumber,
    theTop.theNumber,
    theBeginX,
    theBeginY,
    theEndX,
    theEndY,
    theTransformX,
    theTransformY
  );
  return { result: connection };
}

const connectionSearchString = '.canvas > svg.jtk-connector';
