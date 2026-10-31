module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['engine/**/*.ts'],
      rules: {
        'no-restricted-globals': [
          'error',
          'window',
          'document',
          'chrome',
          'browser',
          'HTMLElement',
          'Range',
          'Selection',
          'fetch',
          'XMLHttpRequest',
          'WebSocket',
        ],
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'wxt/client',
                message: 'Engine modules must not import browser extension client APIs.',
              },
              {
                name: 'wxt/browser',
                message: 'Engine modules must not import browser extension APIs.',
              },
            ],
            patterns: [
              {
                group: ['*entrypoints*'],
                message: 'Engine modules must not depend on entrypoints.',
              },
            ],
          },
        ],
      },
    },
  ],
};
