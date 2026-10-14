const browserGlobals = Object.fromEntries(
  [
      'alert', 'Blob', 'ClipboardItem', 'cancelAnimationFrame', 'clearTimeout', 'confirm', 'console',
      'document', 'fetch', 'FileReader', 'getComputedStyle', 'localStorage', 'navigator', 'Path2D',
    'requestAnimationFrame', 'setTimeout', 'URL', 'window',
  ].map((name) => [name, 'readonly']),
);

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'eqeqeq': 'error',
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
    },
  },
];
