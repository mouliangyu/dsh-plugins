import type { UserConfig } from 'tsdown'

const PACKAGE_NAME = 'dsh-esc-stop'

const host: UserConfig = {
  name: PACKAGE_NAME,
  entry: {
    index: 'lib/types/index.js',
  },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outExtensions: () => ({ js: '.js' }),
  clean: false,
  dts: false,
  deps: { alwaysBundle: () => true },
}

const client: UserConfig = {
  name: `${PACKAGE_NAME}/client`,
  entry: { client: 'lib/types/client/index.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  clean: false,
  dts: false,
  deps: {
    alwaysBundle: (id: string) => id !== 'react' && id !== 'react/jsx-runtime',
    neverBundle: ['react', 'react/jsx-runtime'],
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [host, client]
