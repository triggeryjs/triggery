import triggery from '@triggery/eslint-plugin';

export default [
  triggery.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
];
