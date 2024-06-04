export const FileTree = {
  selectFile(configurationName: string, fileName: string) {
    cy.get(`.jqx-tree-dropdown-root .jqx-tree-item-li`)
      .contains(configurationName)
      .parent()
      .within(() => {
        cy.get(`.jqx-tree-dropdown .jqx-tree-item`).contains(fileName).click();
      });
  },
};
