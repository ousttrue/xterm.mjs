import * as THREE from "three";

export default class RectTarget {
  Scene: THREE.Scene;
  Camera: THREE.Camera;
  Target: null;
  Material?: THREE.ShaderMaterial;
  Rect: THREE.Vector4;

  constructor() {
    this.Scene = new THREE.Scene();
    this.Camera = new THREE.Camera();
    this.Target = null;
    this.Material = undefined;
    this.Rect = new THREE.Vector4(100, 200, 300, 400);
  }

  async Load() {
    // geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE
      .BufferAttribute(new Float32Array([
        0, 0, 0,
        0, 1, 0,
        1, 1, 0,
        1, 0, 0,
      ]), 3));
    geometry.setAttribute('uv', new THREE
      .BufferAttribute(new Float32Array([
        0, 0,
        0, 1,
        1, 1,
        1, 0,
      ]), 2));
    geometry.setIndex([0, 1, 2, 2, 3, 0]);

    // material
    const vs = await fetch('rect.vs');
    const fs = await fetch('rect.fs');
    this.Material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: await vs.text(),
      fragmentShader: await fs.text(),
    });

    // mesh
    const mesh = new THREE.Mesh(geometry, this.Material);
    this.Scene.add(mesh)

    console.log('scene loaded');
  }

  Update(cursorScreen: THREE.Vector4, texture: THREE.Texture) {
    if (this.Material) {
      // console.log(texture);
      this.Material.uniforms.uCursorScreen = { value: cursorScreen }
      this.Material.uniforms.uRect = { value: this.Rect };
      this.Material.uniforms.uTexture = new THREE.Uniform(texture);
    }
  }
}
