import path from 'path'
const PACKAGE_ROOT_PATH = process.cwd()
import includePaths from 'rollup-plugin-includepaths';
export default [
  {
    input: path.join(PACKAGE_ROOT_PATH, 'out', 'browser', 'public', 'Terminal.mjs'),
    output: [
      {
        file: `dist/xterm.mjs`,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      includePaths({ paths: ["./out"] })
    ]
  }
]
