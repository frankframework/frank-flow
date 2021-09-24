describe('Editor tests', function () {
  it('Press editor button', function () {
    cy.visit('');
    cy.get('#btnEditorMode').click();
    cy.get('app-explorer > app-file-tree').contains('Example1');
    cy.get('app-explorer > app-file-tree').contains('Configuration.xml');
    cy.get('app-monaco-editor').contains('<Configuration>');
    cy.get('app-monaco-editor').contains('TestFrankFlow');
    cy.get('#btnFlowMode').click();
    cy.get('app-node').contains('JavaListener');
    cy.get('app-node').contains('TestFrankFlow');
  });
});
