import * as THREE from "three";
import { Terminal } from "../src/browser/public/Terminal.mts";
import { WebglExternalAddon } from "../addons/xterm-addon-webgl/src/WebglExternalAddon.mjs";
import ThreejsScene from "./ThreejsScene.mjs";


function createGlContext(): [HTMLCanvasElement, WebGL2RenderingContext] {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  var w = canvas.clientWidth;
  var h = canvas.clientHeight;
  console.log(w, h);
  canvas.setAttribute('width', `${w}`);
  canvas.setAttribute('height', `${h}`);
  const gl = canvas.getContext('webgl2', {
  });
  console.log(gl);
  console.log(canvas);
  return [canvas, gl];
}


class MainLoop {
  threejsScene: ThreejsScene;
  lastTexture: THREE.Texture = null;
  term: Terminal;
  gl: WebGL2RenderingContext;
  addon: WebglExternalAddon;

  constructor() {
    const [canvas, gl] = createGlContext();
    this.threejsScene = new ThreejsScene(canvas, gl);
    this.gl = gl;

    this.term = new Terminal({
      // theme: theme,
      allowTransparency: false,
      cursorBlink: true,
      disableStdin: false,
      rows: 80,
      cols: 24,
      fontSize: 18
    });

    // setup term and addon
    const el = document.getElementById("terminal");
    if (el) {
      this.term.open(el);
    }

    this.addon = new WebglExternalAddon(gl);
    // @ts-ignore
    this.term.loadAddon(this.addon);

    this.term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const cell = this.addon._renderer!.dimensions.device.cell;

    const [texture, w, h] = this.threejsScene.beginFrame();
    const cols = Math.floor(w / cell.width);
    const rows = Math.floor(h / cell.height);
    const ww = cols * cell.width
    const hh = rows * cell.height;
    this.gl.viewport(0, h - hh,
      ww,
      hh
    );
    if (texture != this.lastTexture) {
      console.log(`${cols} x ${rows}: ${w}(${ww}), ${h}(${hh})`);
      this.term.resize(cols, rows);
      this.lastTexture = texture;
    }
    // TODO: if buffer or atlas updated
    this.addon._renderer.render();

    this.threejsScene.endFrame(texture);
  }
}

document.addEventListener("DOMContentLoaded", async (_event) => {
  const loop = new MainLoop();
  await loop.threejsScene.outer.Load();
  loop.animate();
});

