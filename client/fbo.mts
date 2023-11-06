import * as THREE from "three";


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


export default class Fbo {
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
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
