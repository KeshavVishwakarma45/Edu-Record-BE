// ESLint for the API. The frontend repo (Edu-Record) uses the same shared rules.
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'uploads/**', '.local-db/**'] },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      // console.log is for debugging only; use console.info/warn/error for real messages
      'no-console': ['error', { allow: ['info', 'warn', 'error', 'table'] }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },

  // Must stay last: turns off style rules that Prettier handles
  prettier,
];
