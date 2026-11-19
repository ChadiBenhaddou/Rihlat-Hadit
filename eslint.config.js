import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
      '**/.react-router/**',
      '**/.wrangler/**',
      'apps/web/worker-configuration.d.ts',
      'pipeline/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Tailwind physical-direction utilities break RTL; use logical ones (ms-, pe-, start-).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right)-/]",
          message: 'Use logical Tailwind utilities (ms-, me-, ps-, pe-, start-, end-, text-start) for RTL.',
        },
      ],
    },
  },
);
