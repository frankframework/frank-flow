import { CanvasPoint } from '../support/cancas-point';

describe('CanvasPoint tests', function () {
  const first = new CanvasPoint(10, 10);
  const second = new CanvasPoint(11, 10);
  const third = new CanvasPoint(13, 10);
  const fourth = new CanvasPoint(10, 11);
  const fifth = new CanvasPoint(10, 13);

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
});
