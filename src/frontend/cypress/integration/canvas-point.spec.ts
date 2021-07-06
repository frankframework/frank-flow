import { CanvasNode } from 'cypress/support/canvas-node';
import { CanvasPoint } from '../support/canvas-point';

describe('CanvasPoint tests', function () {
  const first = new CanvasPoint(10, 10);
  const second = new CanvasPoint(11, 10);
  const third = new CanvasPoint(13, 10);
  const fourth = new CanvasPoint(10, 11);
  const fifth = new CanvasPoint(10, 13);

  const node = new CanvasNode('MyNode', 100, 200, 50, 25);

  it('Points are close when x diff small positive', function () {
    expect(first.closeTo(second)).to.be.true;
  });

  it('Points are close when x diff small negative', function () {
    expect(second.closeTo(first)).to.be.true;
  });

  it('Points are not close when x diff is positive', function () {
    expect(first.closeTo(third)).to.be.false;
  });

  it('Points are not close when x diff is negative', function () {
    expect(third.closeTo(first)).to.be.false;
  });

  it('Points are close when y diff is small positive', function () {
    expect(first.closeTo(fourth)).to.be.true;
  });

  it('Points are close when y diff is small negative', function () {
    expect(fourth.closeTo(first)).to.be.true;
  });

  it('Points are not close when y diff is positive', function () {
    expect(first.closeTo(fifth)).to.be.false;
  });

  it('Points are not close when y diff is negative', function () {
    expect(fifth.closeTo(first)).to.be.false;
  });

  it('Point at left is at node', function () {
    const atLeft = new CanvasPoint(100, 210);
    expect(atLeft.atNode(node)).to.be.true;
  });

  it('Point close to left is rounded to be at node', function () {
    const nearLeft = new CanvasPoint(99, 210);
    expect(nearLeft.atNode(node)).to.be.true;
  });

  it('Point at top is at node', function () {
    const atTop = new CanvasPoint(125, 200);
    expect(atTop.atNode(node)).to.be.true;
  });

  it('Point close to top is rounded to be at node', function () {
    const nearTop = new CanvasPoint(125, 199);
    expect(nearTop.atNode(node)).to.be.true;
  });

  it('Point at right is at node', function () {
    const atRight = new CanvasPoint(150, 210);
    expect(atRight.atNode(node)).to.be.true;
  });

  it('Point close to right is rounded to be at node', function () {
    const nearRight = new CanvasPoint(151, 210);
    expect(nearRight.atNode(node)).to.be.true;
  });

  it('Point at bottom is at node', function () {
    const atBottom = new CanvasPoint(125, 225);
    expect(atBottom.atNode(node)).to.be.true;
  });

  it('Point close to bottom is rounded to be at node', function () {
    const nearBottom = new CanvasPoint(125, 226);
    expect(nearBottom.atNode(node)).to.be.true;
  });

  it('Point left of node is not at node', function () {
    const tooLeft = new CanvasPoint(50, 210);
    expect(tooLeft.atNode(node)).to.be.false;
  });

  it('Point above node is not at node', function () {
    const tooHigh = new CanvasPoint(125, 150);
    expect(tooHigh.atNode(node)).to.be.false;
  });

  it('Point right of node is not at node', function () {
    const tooRight = new CanvasPoint(200, 210);
    expect(tooRight.atNode(node)).to.be.false;
  });

  it('Point below node is not at node', function () {
    const tooLow = new CanvasPoint(125, 250);
    expect(tooLow.atNode(node)).to.be.false;
  });
});
