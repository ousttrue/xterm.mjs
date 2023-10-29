import * as path from "path";
import { importMaps } from 'vite-plugin-import-maps';

// vite.config.js
export default {
  // config options
  // root: './',
  // base: '/',
  resolve: {
    alias: {
      "browser": path.resolve(__dirname, "src/browser"),
      "common": path.resolve(__dirname, "src/common"),
    },
  },
  plugins: [
    importMaps([
      {
        imports: {
          "three": "https://unpkg.com/three@v0.157.0/build/three.module.js",
          "three/addons/": "https://unpkg.com/three@v0.157.0/examples/jsm/"
        },
      },
    ]),
  ],
}
