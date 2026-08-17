import type { UserConfig } from 'tsdown'

const PACKAGE_ID = '@deepseek-ai/dsh-client-runtime'
const EXTERNALS = [
  'react', 'react/jsx-runtime', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
]

const host: UserConfig = {
  name: PACKAGE_ID,
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib', format: 'esm', platform: 'node', target: 'node22',
  clean: false, dts: false, fixedExtension: false,
  outExtensions: () => ({ js: '.js' }),
}

const client: UserConfig = {
  name: `${PACKAGE_ID}/client`,
  entry: { client: 'lib/types/client/index.js' },
  outDir: 'lib', format: 'cjs', platform: 'browser', target: 'es2022',
  clean: false, dts: false, fixedExtension: false, external: EXTERNALS,
  noExternal: (id: string) => EXTERNALS.includes(id) ? undefined : true,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [host, client]
