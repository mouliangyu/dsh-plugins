import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const PACKAGE_NAME = 'dsh-remote'
const CSS_PREFIX = '\0dsh-remote-css:'
const CSS_SUFFIX = '.mjs'
const CLIENT_EXTERNALS = [
  'react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives',
]

const host: UserConfig = {
  name: PACKAGE_NAME,
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outExtensions: () => ({ js: '.js' }),
  clean: false,
  dts: false,
}

const bin: UserConfig = {
  name: `${PACKAGE_NAME}/bin`,
  entry: ['lib/types/bin.js'],
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outExtensions: () => ({ js: '.js' }),
  clean: false,
  dts: false,
  outputOptions: { codeSplitting: false },
}

const client: UserConfig = {
  name: `${PACKAGE_NAME}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  clean: false,
  dts: false,
  deps: {
    alwaysBundle: (id: string) => CLIENT_EXTERNALS.includes(id) ? undefined : true,
    neverBundle: CLIENT_EXTERNALS,
  },
  plugins: [{
    name: 'dsh-remote-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const path = importer === undefined ? source : resolve(dirname(importer), source)
      return CSS_PREFIX + path + CSS_SUFFIX
    },
    async load(id: string) {
      if (!id.startsWith(CSS_PREFIX)) return null
      const path = id.slice(CSS_PREFIX.length, -CSS_SUFFIX.length)
      this.addWatchFile(path)
      const { code, exports } = transform({
        filename: path,
        code: await readFile(path),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classes: Record<string, string> = {}
      for (const [local, value] of Object.entries(exports ?? {})) classes[local] = value.name
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(`${PACKAGE_NAME}/${basename(path)}`)};`,
        "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
        "  const tag = document.createElement('style');",
        `  tag.dataset.plugin = ${JSON.stringify(PACKAGE_NAME)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classes)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [host, bin, client]
