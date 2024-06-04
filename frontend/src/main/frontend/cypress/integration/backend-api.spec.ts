describe('Backend API tests', function () {
  before(function () {
    cy.visit('', { timeout: 300_000 });
  });

  it('Check if list of configurations is available', function () {
    cy.request('/api/configurations', { log: true }).then((response) => {
      cy.log(response.body);
    });
  });

  it('Check is the configuration SimpleHelloWorld is given back', function () {
    cy.request('/api/configurations', { log: true }).then((response) => {
      expect(
        response.body,
        'Configuration list should include SimpleHelloWorld'
      ).contains('SimpleHelloWorld');
    });
  });
});
