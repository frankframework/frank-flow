module.exports = {
  root: true,
  ignorePatterns: ['projects/**/*'],
  overrides: [
    {
      files: ['*.ts'],
      parserOptions: {
        project: [
          'tsconfig.app.json',
          'tsconfig.spec.json',
          'tsconfig.worker.json',
          'cypress/tsconfig.json',
        ],
        tsconfigRootDir: __dirname,
        createDefaultProgram: true,
        sourceType: 'module',
      },
      extends: [
        'plugin:@angular-eslint/recommended',
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'plugin:@angular-eslint/template/process-inline-templates',
        'plugin:prettier/recommended'
      ],
      rules: {
        '@angular-eslint/component-selector': [
          'error',
          {
            prefix: 'app',
            style: 'kebab-case',
            type: 'element',
          },
        ],
        '@angular-eslint/directive-selector': [
          'error',
          {
            prefix: 'app',
            style: 'camelCase',
            type: 'attribute',
          },
        ],
      },
    },
    {
      files: ['*.html'],
      extends: ['plugin:@angular-eslint/template/recommended',
        'plugin:prettier/recommended'],
      rules: {},
    },
  ],
};
