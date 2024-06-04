import { FileTree } from '../support/file-tree';

describe('Check canvas loaded', function () {
  before(function () {
    cy.visit('', { timeout: 300_000 });
  });

  it('Check if no canvas message is shown', function () {
    cy.get('.canvas').should('not.be.visible');
    cy.get('.flow-container__no-canvas-message').should('be.visible');
  });

  it('Check is canvas is loaded', function () {
    FileTree.selectFile('SimpleHelloWorld', 'Configuration.xml');
    cy.get('.canvas').should('be.visible');
  });

  it('Check canvas has contents', function () {
    cy.get('.canvas > app-node', { timeout: 30_000 });
  });
});
