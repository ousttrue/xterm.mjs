import { Terminal } from "./dist/xterm.mjs";
import { WebglAddon } from "./dist/xterm-addon-webgl.mjs";
import * as THREE from "three";

const term = new Terminal();
term.open(document.getElementById("terminal"));
term.loadAddon(new WebglAddon());
term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");

const scene = new THREE.Scene();
const camera = new THREE.Camera();
const renderer = new THREE.WebGLRenderer();
renderer.setSize(400, 200);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BufferGeometry();
const vertices = new Float32Array([
  -1.0, 1.0, 0.0,
  1.0, 1.0, 0.0,
  -1.0, -1.0, 0.0,
  1.0, -1.0, 0.0

]);
const uvs = new Float32Array([
  0.0, 1.0,
  1.0, 1.0,
  0.0, 0.0,
  1.0, 0.0
]);
const index = new Uint32Array([
  0, 2, 1,
  1, 2, 3
]);
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
geometry.setIndex(new THREE.BufferAttribute(index, 1));

const vs = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position, 1.0 );
}
`;

const fs = `
varying vec2 vUv;
uniform sampler2D uTex;
void main(){
  vec4 texcel = texture2D(uTex, vUv);
  gl_FragColor = texcel;
  // gl_FragColor = vec4(1,0,0,1);
}
`;

const image = "addons/xterm-addon-image/fixture/testimages/sony-alpha-6000.jpg"
let uniforms = {
  'uTex': {
    type: 't',
    value: new THREE.TextureLoader().load(image)
  }
};
const material = new THREE.ShaderMaterial({
  uniforms: uniforms,
  vertexShader: vs,
  fragmentShader: fs
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
