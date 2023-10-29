import { Terminal as TerminalCore } from "./src/browser/Terminal.mts";
import { WebglExternalAddon } from "./addons/xterm-addon-webgl/src/WebglExternalAddon.mts";
import { BufferNamespaceApi } from './src/common/public/BufferNamespaceApi.mts';

document.addEventListener("DOMContentLoaded", (event) => {
  console.log("DOM fully loaded and parsed");
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl2', {
  });
  console.log(gl);
  console.log(canvas);

  const term = new TerminalCore();
  if (term.open) {
    const el = document.getElementById("terminal");
    if (el) {
      term.open(el);
    }
  }

  const buffer = new BufferNamespaceApi(term);
  const addon = new WebglExternalAddon(gl);
  addon.activateCore(term, buffer, gl);
  term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");

  function animate() {
    requestAnimationFrame(animate);
    addon._renderer.render();
  }
  animate();
});

