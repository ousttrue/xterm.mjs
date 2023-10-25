import * as THREE from "https://unpkg.com/three@v0.157.0/build/three.module.js";
// import { Terminal } from "./dist/xterm.mjs";
import { Terminal } from "./src/browser/public/Terminal.mts";
import { Terminal as Headless } from "./dist/xterm-headless.mjs";
import { WebglExternalAddon } from "./dist/WebglExternalAddon.mjs";
import { WebglAddon } from "./dist/xterm-addon-webgl.mjs";

document.addEventListener("DOMContentLoaded", (event) => {
  console.log("DOM fully loaded and parsed");
  // const scene = new THREE.Scene();
  // const camera = new THREE.Camera();
  // // https://blog.kimizuka.org/entry/2021/02/18/003300
  // const renderer = new THREE.WebGLRenderer({
  //   preserveDrawingBuffer: true
  // });
  // renderer.setSize(400, 200);
  // document.body.appendChild(renderer.domElement);

  // const geometry = new THREE.BufferGeometry();
  // const vertices = new Float32Array([
  //   -1.0, 1.0, 0.0,
  //   1.0, 1.0, 0.0,
  //   -1.0, -1.0, 0.0,
  //   1.0, -1.0, 0.0
  //
  // ]);
  // const uvs = new Float32Array([
  //   0.0, 1.0,
  //   1.0, 1.0,
  //   0.0, 0.0,
  //   1.0, 0.0
  // ]);
  // const index = new Uint32Array([
  //   0, 2, 1,
  //   1, 2, 3
  // ]);
  // geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  // geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  // geometry.setIndex(new THREE.BufferAttribute(index, 1));
  //
  // const vs = `
  // varying vec2 vUv;
  // void main() {
  //   vUv = uv;
  //   gl_Position = vec4( position, 1.0 );
  // }
  // `;
  //
  // const fs = `
  // varying vec2 vUv;
  // uniform sampler2D uTex;
  // void main(){
  //   vec4 texcel = texture2D(uTex, vUv);
  //   gl_FragColor = texcel;
  //   // gl_FragColor = vec4(1,0,0,1);
  // }
  // `;
  //
  // const image = "addons/xterm-addon-image/fixture/testimages/sony-alpha-6000.jpg"
  // let uniforms = {
  //   'uTex': {
  //     type: 't',
  //     value: new THREE.TextureLoader().load(image)
  //   }
  // };
  // const material = new THREE.ShaderMaterial({
  //   uniforms: uniforms,
  //   vertexShader: vs,
  //   fragmentShader: fs
  // });
  // const mesh = new THREE.Mesh(geometry, material);
  // scene.add(mesh);

  // const gl = renderer.getContext();
  // const canvas = renderer.domElement;

  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl2', {
    // antialias: false,
    // depth: false,
    // preserveDrawingBuffer: true,
  });
  console.log(gl);
  console.log(canvas);

  // TODO: render to exists context

  const term = new Terminal();
  // const term = new Headless();
  if (term.open) {
    term.open(document.getElementById("terminal"));
  }
  const addon = new WebglExternalAddon(canvas, gl);
  // const addon = new WebglAddon();
  term.loadAddon(addon);
  term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");

  // class State {
  //   constructor(gl) {
  //     this.gl = gl;
  //     this.prog = null;
  //     this.a = null;
  //     this.e = null;
  //   }
  //   save() {
  //     const gl = this.gl;
  //     this.prog = gl.getParameter(gl.CURRENT_PROGRAM);
  //     this.a = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  //     this.e = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);
  //   }
  //   load() {
  //     const gl = this.gl;
  //     gl.useProgram(this.prog);
  //     if (this.a) {
  //       gl.bindBuffer(gl.ARRAY_BUFFER, this.a);
  //     }
  //     if (this.e) {
  //       gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.e);
  //     }
  //   }
  // }
  // let state = new State(gl);

  function animate() {
    requestAnimationFrame(animate);

    // gl.disable(gl.DEPTH_TEST);
    // // gl.depthFunc(gl.NEVER);
    // gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    // // Clear the canvas.
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // state.load();
    // renderer.render(scene, camera);
    // state.save();
    // addon._renderer.renderRows(1, 10);
    addon._renderer.render();
  }
  animate();
});

