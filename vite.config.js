import fs from 'fs'
import * as path from "path";
import { importMaps } from 'vite-plugin-import-maps';

// vite.config.js
export default {
  server: {
    https: {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost.pem'),
    }
  },
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
          "three/addons/": "https://unpkg.com/three@v0.157.0/examples/jsm/",
          "aframe": "https://aframe.io/releases/1.4.0/aframe.min.js",
        },
      },
    ]),
  ],
}

