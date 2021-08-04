import { CanvasPoint } from 'cypress/support/canvas-point';
import { CanvasConnectionArea } from '../support/canvas-connection-area';

describe('Test support class CanvasConnectionArea', function () {
  it('Calculate center', function () {
    const instance = new CanvasConnectionArea(100, 200, 50, 25);
    const center = instance.getCenter();
    cy.log('Center of area: ' + center.toString());
    expect(center.closeTo(new CanvasPoint(125, 212.5))).to.be.true;
  });
});
