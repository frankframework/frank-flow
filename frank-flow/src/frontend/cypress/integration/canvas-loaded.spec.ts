describe('Check canvas loaded', function () {
  before(function () {
    cy.visit('', { timeout: 300000 });
  });

  it('Check head', function () {
    cy.get('head');
  });

  it('Check body', function () {
    cy.get('body');
  });

  it('Check canvas', function () {
    cy.get('.canvas');
  });
});
