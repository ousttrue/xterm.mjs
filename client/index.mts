import * as THREE from "three";
import { Terminal as TerminalCore } from "../src/browser/Terminal.mts";
import { WebglExternalRenderer } from "../addons/xterm-addon-webgl/src/WebglExternalRenderer.mts";
import { BufferNamespaceApi } from '../src/common/public/BufferNamespaceApi.mts';
import FixedCharSizeService from "./FixedCharSizeService.mjs";
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
  term: TerminalCore;
  charSizeService: FixedCharSizeService;
  addon: WebglExternalRenderer;

  constructor() {
    const [canvas, gl] = createGlContext();
    this.threejsScene = new ThreejsScene(canvas, gl);

    // setup term and addon
    this.term = new TerminalCore();
    const el = document.getElementById("terminal");
    if (el) {
      this.term.open(el);
    }
    const buffer = new BufferNamespaceApi(this.term);
    this.charSizeService = new FixedCharSizeService();
    this.charSizeService.setSize(9, 18);

    this.addon = new WebglExternalRenderer(
      gl, this.term, buffer,
      this.charSizeService,
      this.term._coreBrowserService,
      this.term.coreService,
      this.term._decorationService,
      this.term.optionsService,
      this.term._themeService,
    );
    const renderService = this.term._renderService;
    renderService.setRenderer(this.addon);
    this.term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const [texture, w, h] = this.threejsScene.beginFrame();
    if (texture != this.lastTexture) {
      const cols = Math.floor(w / this.charSizeService.width);
      const rows = Math.floor(h / this.charSizeService.height);
      console.log('colsxrows', cols, rows);
      this.term.resize(cols, rows);
      this.lastTexture = texture;
    }
    for (const { start, end } of this.addon.Invalidates) {
      this.addon.render(start, end);
    }
    this.addon.Invalidates.length = 0;

    this.threejsScene.endFrame(texture);
  }
}


document.addEventListener("DOMContentLoaded", async (_event) => {
  const loop = new MainLoop();
  await loop.threejsScene.outer.Load();
  loop.animate();
});

