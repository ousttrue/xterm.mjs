import * as THREE from "three";
import { Terminal as TerminalCore } from "../src/browser/Terminal.mts";
import { WebglExternalRenderer } from "../addons/xterm-addon-webgl/src/WebglExternalRenderer.mts";
import { BufferNamespaceApi } from '../src/common/public/BufferNamespaceApi.mts';
import { IRenderDimensions, IRenderer } from "../src/browser/renderer/shared/Types.mts";
import { IRenderDebouncerWithCallback } from "../src/browser/Types.mts";
import { IBufferService } from "../src/common/services/Services.mts";
import FixedCharSizeService from "./FixedCharSizeService.mjs";
import ThreejsScene from "./ThreejsScene.mjs";


document.addEventListener("DOMContentLoaded", async (event) => {
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

  const threejsScene = new ThreejsScene(canvas, gl);
  await threejsScene.outer.Load();

  const term = new TerminalCore();
  if (term.open) {
    const el = document.getElementById("terminal");
    if (el) {
      term.open(el);
    }
  }

  const buffer = new BufferNamespaceApi(term);

  // term._core = term;
  const charSizeService = new FixedCharSizeService();
  charSizeService.setSize(9, 18);

  const addon = new WebglExternalRenderer(
    gl, term, buffer,
    charSizeService,
    term._coreBrowserService,
    term.coreService,
    term._decorationService,
    term.optionsService,
    term._themeService,
  );
  const renderService = term._renderService;
  renderService.setRenderer(addon);

  // const addon = new WebglExternalAddon(gl);
  // addon.activateCore(term, buffer, gl);
  term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");

  let lastTexture: THREE.Texture = null;
  function animate() {
    requestAnimationFrame(animate);

    const [fbo, texture, w, h] = threejsScene.beginFrame();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    if (texture != lastTexture) {
      const cols = Math.floor(w / charSizeService.width);
      const rows = Math.floor(h / charSizeService.height);
      console.log('colsxrows', cols, rows);
      term.resize(cols, rows);
      lastTexture = texture;
    }
    for (const { start, end } of addon.Invalidates) {
      addon.render(start, end);
    }
    addon.Invalidates.length = 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    threejsScene.endFrame(texture);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  animate();
});

