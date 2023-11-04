import XRTTty from './XRTTty.mjs';
const THREE = AFRAME.THREE;

type Scheme = {
  width: number,
  height: number,
  depth: number,
  color: string,
  background: string,
}

export default class TermObject {
  bg_material: THREE.Material;
  bg_mesh: THREE.Mesh;

  // from a-frame variables
  _aframebuffergeometry: THREE.BufferGeometry;
  glyph_texture: THREE.CanvasTexture;
  glyph_el: typeof AFRAME.AEntity;

  constructor(data: Scheme) {
    // create BG material and mesh
    const geometry = new THREE.BoxGeometry(data.width, data.height, data.depth);
    this.bg_material = new THREE.MeshBasicMaterial({
      color: data.background,
      side: THREE.FrontSide,
    });
    this.bg_mesh = new THREE.Mesh(geometry, this.bg_material)

    // create FG material and mesh
    // const glyph = renderer.GlyphRenderer;
    // const aframe_pos_att = new AFRAME.THREE.BufferAttribute(glyph.positions, 3);
    // aframe_pos_att.usage = AFRAME.THREE.DynamicDrawUsage;
    // const aframe_uv_att = new AFRAME.THREE.BufferAttribute(glyph.uvs, 2);
    // aframe_uv_att.usage = AFRAME.THREE.DynamicDrawUsage;
    // this._aframebuffergeometry = new AFRAME.THREE.BufferGeometry();
    // this._aframebuffergeometry.setAttribute('position', aframe_pos_att);
    // this._aframebuffergeometry.attributes.position.needsUpdate = true;
    // this._aframebuffergeometry.setAttribute('uv', aframe_uv_att);
    // this._aframebuffergeometry.attributes.uv.needsUpdate = true;
    // this._aframebuffergeometry.setIndex(new AFRAME.THREE.BufferAttribute(glyph.idx, 1));
    //
    // this.glyph_texture = new THREE.CanvasTexture(renderer.textureAtlas!);
    // this.glyph_texture.needsUpdate = true;
    //
    // const glyph_mesh = new THREE.Mesh(
    //   this._aframebuffergeometry,
    //   new THREE.MeshBasicMaterial({
    //     map: this.glyph_texture,
    //     color: data.color,
    //     transparent: true
    //   }));
    // this.glyph_el = document.createElement('a-entity');
    // this.glyph_el.setObject3D('mesh', glyph_mesh);
    // const factor = 1 / renderer._terminal.rows;;
    // this.glyph_el.object3D.scale.set(
    //   factor,
    //   factor,
    //   factor,
    // );
    // this.glyph_el.object3D.position.set(
    //   -data.width * 0.5 + data.width * 0.5 / renderer._terminal.cols,
    //   data.height * 0.5,
    //   data.depth * 0.5 + 0.005);
  }
}
