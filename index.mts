import * as THREE from "three";
import { Terminal as TerminalCore } from "./src/browser/Terminal.mts";
import { WebglExternalRenderer } from "./addons/xterm-addon-webgl/src/WebglExternalRenderer.mts";
import { BufferNamespaceApi } from './src/common/public/BufferNamespaceApi.mts';
import RectTarget from './recttarget.mts';
import State from './state.mts'
import { Disposable } from "./src/common/Lifecycle.mts";
import { ICharSizeService } from "./src/browser/services/Services.mts";
import { EventEmitter } from "./src/common/EventEmitter.mts";

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

class FixedCharSizeService extends Disposable implements ICharSizeService {
  public serviceBrand: undefined;
  public width: number = 0;
  public height: number = 0;
  public get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }
  private readonly _onCharSizeChange = this.register(new EventEmitter<void>());
  public readonly onCharSizeChange = this._onCharSizeChange.event;
  constructor(
  ) {
    super();
  }
  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.measure();
  }
  public measure(): void {
    const result = { width: 9, height: 17 };
    if (result.width !== this.width || result.height !== this.height) {
      console.log(result);
      this.width = result.width;
      this.height = result.height;
      this._onCharSizeChange.fire();
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

  // term._core = term;
  const charSizeService = new FixedCharSizeService();
  charSizeService.setSize(24, 48);

  const addon = new WebglExternalRenderer(
    gl, term, buffer,
    charSizeService,
    // term._charSizeService,
    term._coreBrowserService,
    term.coreService,
    term._decorationService,
    term.optionsService,
    term._themeService,
  );
  term._renderService.setRenderer(addon);

  // const addon = new WebglExternalAddon(gl);
  // addon.activateCore(term, buffer, gl);
  term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");

  let lastTexture: THREE.Texture = null;
  function animate() {
    requestAnimationFrame(animate);

    const [fbo, texture, w, h] = threejsScene.beginFrame();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    if (texture == lastTexture) {
      for (const { start, end } of addon.Invalidates) {
        addon.render(start, end);
      }
    }
    else {
      // TODO: redraw
      console.log('new texture');
      addon.render(0, term.rows);
    }
    lastTexture = texture;
    addon.Invalidates.length = 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    threejsScene.endFrame(texture);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  animate();
});

