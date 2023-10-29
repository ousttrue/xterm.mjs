import * as THREE from "three";
import { Terminal as TerminalCore } from "./src/browser/Terminal.mts";
import { WebglExternalAddon } from "./addons/xterm-addon-webgl/src/WebglExternalAddon.mts";
import { BufferNamespaceApi } from './src/common/public/BufferNamespaceApi.mts';
import RectTarget from './recttarget.mts';
import State from './state.mts'

class ThreejsScene {
  rt?: THREE.WebGLRenderTarget<THREE.Texture>;
  outer: RectTarget;
  state: State;
  constructor(canvas: HTMLCanvasElement, private _gl: WebGL2RenderingContext) {
    this.outer = new RectTarget();

    this.state = new State(canvas, this._gl,
      (dx, dy) => {
        this.outer.Rect.x += dx;
        this.outer.Rect.y += dy;
      },
      (dx, dy) => {
        this.outer.Rect.width += dx;
        this.outer.Rect.height += dy;
      });
  }

  beginFrame(): THREE.WebGLRenderTarget<THREE.Texture> | null {
    const w = this.outer.Rect.width;
    const h = this.outer.Rect.height;
    if (w > 0 && h > 0) {
      if (!this.rt || w != this.rt.width || h != this.rt.height) {
        console.log('create rt', w, h)
        this.rt = new THREE.WebGLRenderTarget(w, h);
      }
      const framebuffer = this.rt.__webglFramebuffer;
      this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, framebuffer);
      this._gl.viewport(0, 0, w, h);
      this._gl.clearColor(1, 0, 0, 1);
      this._gl.clear(this._gl.COLOR_BUFFER_BIT);
    }

    return this.rt;
  }

  endFrame(rt: THREE.WebGLRenderTarget<THREE.Texture>) {
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, null);
    this.state._renderer.resetState();
    this.state._renderer.setRenderTarget(null);
    if (rt) {
      // console.log('endFrame', rt);
      this.outer.Update(this.state.CursorScreen, rt.texture);
      this.state._renderer.render(this.outer.Scene, this.outer.Camera);
    }
  }
}

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
  const addon = new WebglExternalAddon(gl);
  addon.activateCore(term, buffer, gl);
  term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");

  function animate() {
    requestAnimationFrame(animate);

    const rt = threejsScene.beginFrame();
    addon._renderer.render();
    threejsScene.endFrame(rt);
  }

  animate();
});

