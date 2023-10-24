import path from 'path'
const ROOT = process.cwd()
import includePaths from 'rollup-plugin-includepaths';
export default [
  {
    input: [
      path.join(ROOT, 'out', 'browser', 'public', 'Terminal.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-attach', 'out', 'AttachAddon.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-canvas', 'out', 'CanvasAddon.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-fit', 'out', 'FitAddon.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-image', 'out', 'ImageAddon.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-search', 'out', 'SearchAddon.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-serialize', 'out', 'SerializeAddon.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-unicode-graphemes', 'out', 'UnicodeGraphemesAddon.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-unicode11', 'out', 'Unicode11Addon.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-web-links', 'out', 'WebLinksAddon.mjs'),
      path.join(ROOT, 'addons', 'xterm-addon-webgl', 'out', 'WebGlAddon.mjs'),
    ],
    output: [
      {
        dir: `dist`,
        format: 'esm',
        sourcemap: true,
        entryFileNames: chunk => {

          if (chunk.facadeModuleId.endsWith("Terminal.mjs")) {
            return "xterm.mjs"
          }
          else {
            return "[name].mjs"
          }
        }
      },
    ],
    plugins: [
      includePaths({ paths: ["./out"] })
    ]
  }
]
