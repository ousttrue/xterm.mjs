import * as THREE from "three";
import { Terminal as TerminalCore } from "./src/browser/Terminal.mts";
import { WebglExternalAddon } from "./addons/xterm-addon-webgl/src/WebglExternalAddon.mts";
import { BufferNamespaceApi } from './src/common/public/BufferNamespaceApi.mts';
import RectTarget from './recttarget.mts';
import State from './state.mts'

function wrapTexture(r: THREE.Renderer, texture: WebGLTexture): THREE.Texture {
  // https://stackoverflow.com/questions/29325906/can-you-use-raw-webgl-textures-with-three-js
  const forceTextureInitialization = function() {
    const material = new THREE.MeshBasicMaterial();
    const geometry = new THREE.BoxGeometry();
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.Camera();

    return function forceTextureInitialization(tex: THREE.Texture) {
      material.map = tex;
      r.render(scene, camera);
    };
  }();
  const wrap = new THREE.Texture();
  forceTextureInitialization(wrap);  // force three.js to init the texture
  const texProps = r.properties.get(wrap);
  texProps.__webglTexture = texture;
  return wrap;
}

class Fbo {
  frameBuffer: WebGLFramebuffer;
  fTexture: WebGLTexture;
  wrap: THREE.Texture;
  width = 0;
  height = 0;

  constructor(private _gl: WebGL2RenderingContext) {
  }

  getOrCreate(width: number, height: number, r: THREE.Renderer)
    : [WebGLFramebuffer, THREE.Texture] {
    const gl = this._gl;
    if (this.frameBuffer && width == this.width && height == this.height) {
      return [this.frameBuffer, this.wrap];
    }

    if (this.frameBuffer) {
      gl.deleteFramebuffer(this.frameBuffer);
      gl.deleteTexture(this.fTexture);
    }
    this.width = width;
    this.height = height;

    this.fTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.wrap = wrapTexture(r, this.fTexture);

    console.log('create fbo', width, height, this.frameBuffer);
    return [this.frameBuffer, this.wrap];
  }
}

class ThreejsScene {
  fbo: Fbo;
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

    this.fbo = new Fbo(this._gl);
  }

  beginFrame(): [WebGLFramebuffer, THREE.Texture, number, number] | null {
    const w = this.outer.Rect.width;
    const h = this.outer.Rect.height;
    if (w == 0 || h == 0) {
      return;
    }

    const [fbo, texture] = this.fbo.getOrCreate(w, h, this.state._renderer);
    return [fbo, texture, w, h];
  }

  endFrame(texture: THREE.Texture) {
    this.state._renderer.resetState();
    if (texture) {
      // console.log('endFrame', rt);
      this.outer.Update(this.state.CursorScreen, texture);
      this.state._renderer.render(this.outer.Scene, this.outer.Camera);
      this.state._renderer.resetState();
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

    const [fbo, texture, w, h] = threejsScene.beginFrame();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);

    for (const { start, end } of addon._renderer.Invalidates) {
      addon._renderer.render(start, end);
    }
    addon._renderer.Invalidates.length = 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    threejsScene.endFrame(texture);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  animate();
});

