import path from 'path'
import includePaths from 'rollup-plugin-includepaths';

const ROOT = process.cwd()

const AddonMap = {
  'AttachAddon.mjs': 'xterm-addon-attach',
  'CanvasAddon.mjs': 'xterm-addon-canvas',
  'FitAddon.mjs': 'xterm-addon-fit',
  'ImageAddon.mjs': 'xterm-addon-image',
  'SearchAddon.mjs': 'xterm-addon-search',
  'SerializeAddon.mjs': 'xterm-addon-serialize',
  'UnicodeGraphemesAddon.mjs': 'xterm-addon-unicode-graphemes',
  'Unicode11Addon.mjs': 'xterm-addon-unicode11',
  'WebLinksAddon.mjs': 'xterm-addon-web-links',
  'WebGlAddon.mjs': 'xterm-addon-webgl',
}

const input = [
  path.join(ROOT, 'out', 'browser', 'public', 'Terminal.mjs'),
  path.join(ROOT, 'addons', 'xterm-addon-webgl', 'out', 'WebGlExternalAddon.mjs'),
]
for (const k in AddonMap) {
  input.push(
    path.join(ROOT, 'addons', AddonMap[k], 'out', k));
}

export default [
  {
    input: input,
    output: [
      {
        dir: `dist`,
        format: 'esm',
        sourcemap: true,
        entryFileNames: chunk => {
          if (chunk.facadeModuleId.endsWith("Terminal.mjs")) {
            return "xterm.mjs"
          }

          const name = path.basename(chunk.facadeModuleId);
          const addon = AddonMap[name]
          if (addon) {
            return `${addon}.mjs`
          }

          return '[name].mjs'
        }
      },
    ],
    plugins: [
      includePaths({ paths: ["./out"] })
    ]
  }
]
