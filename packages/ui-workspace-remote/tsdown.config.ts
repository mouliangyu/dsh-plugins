import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const PACKAGE_ID = '@deepseek-ai/dsh-client-ui-workspace'
const CSS_PREFIX = '\0dsh-client-ui-workspace-remote-css:'
const CSS_SUFFIX = '.mjs'
const EXTERNALS = [
  'react', 'react/jsx-runtime', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client', '@deepseek-ai/dsh-client-locale/client',
]

const host: UserConfig = {
  name: PACKAGE_ID,
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib', format: 'esm', platform: 'node', target: 'node22', clean: false, dts: false,
  fixedExtension: false, outExtensions: () => ({ js: '.js' }),
}

const client: UserConfig = {
  name: `${PACKAGE_ID}/client`,
  entry: { client: 'lib/types/client/index.js' },
  outDir: 'lib', format: 'cjs', platform: 'browser', target: 'es2022', clean: false, dts: false,
  fixedExtension: false,
  external: EXTERNALS,
  noExternal: (id: string) => EXTERNALS.includes(id) ? undefined : true,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [{
    name: 'dsh-remote-css-modules',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const path = importer === undefined ? source : resolve(dirname(importer), source)
      return CSS_PREFIX + path + CSS_SUFFIX
    },
    async load(id: string) {
      if (!id.startsWith(CSS_PREFIX)) return null
      let path = id.slice(CSS_PREFIX.length, -CSS_SUFFIX.length)
      if (!existsSync(path)) {
        const marker = '/lib/types/'
        const boundary = path.indexOf(marker)
        if (boundary !== -1) path = resolve(path.slice(0, boundary), 'src', path.slice(boundary + marker.length))
      }
      this.addWatchFile(path)
      const result = transform({ filename: path, code: await readFile(path), cssModules: { pattern: '[hash]_[local]' }, minify: true })
      const classes: Record<string, string> = {}
      for (const [local, value] of Object.entries(result.exports ?? {})) classes[local] = value.name
      const tagId = `${PACKAGE_ID}/${basename(path)}`
      return [`const css = ${JSON.stringify(result.code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
        "  const tag = document.createElement('style'); tag.dataset.plugin = 'dsh-client-ui-workspace'; tag.dataset.pluginCss = tagId; tag.textContent = css; document.head.appendChild(tag);",
        '}', `export default ${JSON.stringify(classes)};`].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [host, client]
