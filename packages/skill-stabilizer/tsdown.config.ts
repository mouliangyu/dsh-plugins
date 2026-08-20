import type { UserConfig } from 'tsdown'

const PACKAGE_NAME = 'dsh-skill-stabilizer'

const host: UserConfig = {
  name: PACKAGE_NAME,
  entry: {
    index: 'lib/types/index.js',
    invariant: 'lib/types/invariant.js',
  },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outExtensions: () => ({ js: '.js' }),
  clean: false,
  dts: false,
}

export default [host]
