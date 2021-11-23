describe('Palette tests', function () {
  it('All element groups are present', function () {
    cy.visit('');
    cy.get('app-palette > app-group').contains('Listeners');
    cy.get('app-palette > app-group').contains('PullingJmsListener');
    cy.get('app-palette > app-group').contains('Pipes');
    cy.get('app-palette > app-group').contains('Adios2XmlPipe');
    cy.get('app-palette > app-group').contains('Senders');
    // We test here that we have element names as they are accepted by the XSD.
    // We do not merely want Java class names.
    cy.get('app-palette > app-group').contains('Afm2EdiFactSender');
    cy.get('app-palette > app-group').contains('Afm2EdiFactErrorSender');
    cy.get('app-palette > app-group').contains('Validators');
    cy.get('app-palette > app-group').contains('ApiWsdlXmlInputValidator');
    cy.get('app-palette > app-group').contains('ApiWsdlXmlOutputValidator');
    cy.get('app-palette > app-group').contains('Other');
    cy.get('app-palette > app-group').contains('Exit');
    cy.get('app-palette > app-group').contains('Adapter');
  });
});
