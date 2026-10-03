import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      complexity: ['error', 12], 'max-depth': ['error', 3],
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 65, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': ['error', { selector: 'ExportAllDeclaration', message: 'Use direct imports, not re-exports.' }]
    }
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['node:*', '../application/*', '../adapters/*'] }] }
  },
  {
    files: ['src/application/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['node:*', '../adapters/*'] }] }
  }
);
