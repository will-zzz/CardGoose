import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist', '**/*.d.ts'] },
  {
    files: ['**/*.ts'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
];
