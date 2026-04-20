import kinhale from '@kinhale/eslint-config';

export default [
  ...kinhale,
  {
    // Root-level configs (ESM) — assoupli car il s'agit de fichiers de configuration
    files: ['*.{js,mjs,cjs}', '*.config.{js,mjs,cjs,ts}'],
    rules: {
      'no-console': 'off',
    },
  },
];
