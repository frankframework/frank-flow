it('loads examples', { browser: 'chrome' }, () => {
  cy.visit('/');
  cy.contains('Listeners');
});
