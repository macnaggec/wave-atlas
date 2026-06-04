// @ts-check
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

/** @type {import('typescript-eslint').Config} */
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      'src/app/routeTree.gen.ts',
    ],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { boundaries },
    languageOptions: {
      parser: tseslint.parser,
    },
    settings: {
      'boundaries/elements': [
        { type: 'app',     pattern: 'src/app/**' },
        { type: 'views',   pattern: 'src/views/**' },
        { type: 'widgets', pattern: 'src/widgets/**' },
        // Each sub-folder of features/ is its own element; featureName is captured for
        // the same-feature allow rule below (C2 guard).
        {
          type: 'feature',
          pattern: 'src/features/*/**',
          capture: ['featureName'],
        },
        { type: 'entities', pattern: 'src/entities/**' },
        { type: 'shared',   pattern: 'src/shared/**' },
        { type: 'server',   pattern: 'src/server/**' },
        { type: 'test',     pattern: 'src/test/**' },
        { type: 'types',    pattern: 'src/types/**' },
      ],
      // eslint-import-resolver-typescript resolves the '*' → './src/*' tsconfig alias so
      // boundaries can match resolved paths against element patterns.
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      // Baseline mode: 'warn' so existing violations don't block builds.
      // F4 will fix the two named upward imports (mapCommands → app/router,
      // UploadPipeline → app/trpcClient) and flip these to 'error'.
      'boundaries/dependencies': ['warn', {
        default: 'disallow',
        rules: [
          // app may import any layer (including server: tRPC requires the router type for e2e typesafety)
          { from: { type: 'app' },     allow: { to: { type: ['views', 'widgets', 'feature', 'entities', 'shared', 'server', 'types'] } } },
          // views may import widgets and below
          { from: { type: 'views' },   allow: { to: { type: ['widgets', 'feature', 'entities', 'shared', 'types'] } } },
          // widgets may import features and below
          { from: { type: 'widgets' }, allow: { to: { type: ['feature', 'entities', 'shared', 'types'] } } },
          // C2 guard: a feature may only import entities, shared, and its OWN feature folder.
          // {{featureName}} resolves to the featureName captured from the source (from) element.
          {
            from: { type: 'feature' },
            allow: {
              to: [
                { type: 'entities' },
                { type: 'shared' },
                { type: 'types' },
                { type: 'feature', captured: { featureName: '{{featureName}}' } },
              ],
            },
          },
          // entities may only import shared
          { from: { type: 'entities' }, allow: { to: { type: ['shared', 'types'] } } },
          // shared: no local layer imports (violations here are real bugs — buildGalleryRows importing entities)
          // server: imports from server, shared (kernel types), and entities (domain types used server-side)
          { from: { type: 'server' },  allow: { to: { type: ['server', 'shared', 'entities'] } } },
          // test helpers may import anything
          { from: { type: 'test' },    allow: { to: { type: ['app', 'views', 'widgets', 'feature', 'entities', 'shared', 'server', 'types'] } } },
        ],
      }],
    },
  },
);
