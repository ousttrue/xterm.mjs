import * as path from "path";

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
  ]
}
