import { CanvasPoint } from './cancas-point';

describe('CanvasPoint tests', function () {
  it('Points are close when x and y diffs small positive', function () {
    const first = new CanvasPoint(10, 10);
    const second = new CanvasPoint(11, 11);
    expect(first.closeTo(second)).toBeTrue();
  });
});
