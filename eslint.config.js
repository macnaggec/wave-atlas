// @ts-check
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

const serverClientIntegrationRestriction = {
  group: ['shared/lib/trpc', 'shared/lib/trpcClient', 'shared/lib/queryClient'],
  message: 'Server code must use server/trpc and server-safe shared contracts, not browser tRPC/query clients.',
};

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
        // Each entity slice is its own element; entityName is captured for the
        // same-entity allow rule (internal imports stay legal; external must use the index).
        {
          type: 'entity',
          pattern: 'src/entities/*/**',
          capture: ['entityName'],
        },
        { type: 'shared',  pattern: 'src/shared/**' },
        // test must come before server so that *.test.ts files inside src/server/ and
        // src/entities/ are classified as test (and allowed full access) rather than
        // as their containing layer (which would block src/test/** helper imports).
        { type: 'test',    pattern: ['src/test/**', 'src/**/*.test.ts', 'src/**/*.spec.ts'] },
        { type: 'server',  pattern: 'src/server/**' },
        { type: 'types',   pattern: 'src/types/**' },
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
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        rules: [
          // app may import any layer (including server: tRPC requires the router type for e2e typesafety)
          // Entity imports are index-only: app code may not reach into entity internals.
          {
            from: { type: 'app' },
            allow: {
              to: [
                { type: 'views' }, { type: 'widgets' }, { type: 'feature' },
                { type: 'entity', path: 'src/entities/*/index.ts' },
                { type: 'shared' }, { type: 'server' }, { type: 'types' },
              ],
            },
          },
          // views may import widgets and below
          {
            from: { type: 'views' },
            allow: {
              to: [
                { type: 'widgets' }, { type: 'feature' },
                { type: 'entity', path: 'src/entities/*/index.ts' },
                { type: 'shared' }, { type: 'types' },
              ],
            },
          },
          // widgets may import features and below
          {
            from: { type: 'widgets' },
            allow: {
              to: [
                { type: 'feature' },
                { type: 'entity', path: 'src/entities/*/index.ts' },
                { type: 'shared' }, { type: 'types' },
              ],
            },
          },
          // C2 guard: a feature may only import shared, its OWN feature folder, and entity
          // indexes (the published contract surface — never entity internals directly).
          {
            from: { type: 'feature' },
            allow: {
              to: [
                { type: 'entity', path: 'src/entities/*/index.ts' },
                { type: 'shared' },
                { type: 'types' },
                { type: 'feature', captured: { featureName: '{{featureName}}' } },
              ],
            },
          },
          // entity: a slice may import its own internals freely; cross-entity imports must
          // go through the target entity's public index only (same contract rule as features).
          // app/lib/trpc.ts (React context hooks) and app/lib/trpcClient.ts (raw HTTP client)
          // are narrow infrastructure exceptions. QW13 will move both to shared/lib/.
          {
            from: { type: 'entity' },
            allow: {
              to: [
                { type: 'entity', captured: { entityName: '{{entityName}}' } },
                { type: 'entity', path: 'src/entities/*/index.ts' },
                { type: 'shared' },
                { type: 'types' },
                { type: 'app', path: 'src/app/lib/trpc.ts' },
                { type: 'app', path: 'src/app/lib/trpcClient.ts' },
              ],
            },
          },
          // shared/lib/trpc.ts and trpcClient.ts need a type-only import of AppRouter from server/router
          // for tRPC end-to-end type safety. This is erased at compile time — no runtime coupling.
          { from: { type: 'shared', path: 'src/shared/lib/trpc*.ts' }, allow: { to: [{ type: 'server', path: 'src/server/router.ts' }] } },
          // server: routes/services/repositories may use entity indexes (for domain types/schemas)
          // plus server-internal modules and shared kernel.
          { from: { type: 'server' },  allow: { to: [{ type: 'server' }, { type: 'shared' }, { type: 'types' }, { type: 'entity', path: 'src/entities/*/index.ts' }] } },
          // test helpers may import anything
          { from: { type: 'test' },    allow: { to: { type: ['app', 'views', 'widgets', 'feature', 'entity', 'shared', 'server', 'types'] } } },
        ],
      }],
    },
  },
  {
    files: ['src/server/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [serverClientIntegrationRestriction],
      }],
    },
  },
  {
    files: ['src/server/repositories/**/*.ts'],
    ignores: ['src/server/repositories/**/*.test.ts', 'src/server/repositories/**/*.integration.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          serverClientIntegrationRestriction,
          {
            group: ['server/services/*', 'server/providers/*', 'server/providers/**/*'],
            message: 'Repositories must stay persistence-only. Put workflow and provider orchestration in services.',
          },
        ],
      }],
    },
  },
);
