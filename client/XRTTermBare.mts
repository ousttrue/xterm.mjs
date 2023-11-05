/// @ts-check
import CM from '../Common.mjs'
import Fbo from './fbo.mjs';

export default class XRTTermBare {
  threeRenderer: THREE.Renderer;
  fbo: Fbo;
  gl: WebGL2RenderingContext;
  invalidated = false;
  tty: XRTTty;
  previousFrameBuffer: any;
  material: any;
  count = 0;

  constructor(component: typeof AFRAME.AComponent) {
    this.threeRenderer = document.querySelector('a-scene')!.renderer;
    this.material = new THREE.MeshBasicMaterial({});
    this.material.needsUpdate = true;
    component.el.object3D.children[0].material = this.material;
    // const model = component.el.getObject3D('mesh');
    // model.traverse((node) => {
    //   if (node.isMesh) {
    //     node.frustumCulled = false;
    //   }
    // });

    // @ts-ignore
    this.gl = this.threeRenderer.getContext();
    this.fbo = new Fbo(this.gl);

    // @ts-ignore
    this.tty = (component.el.components['xrtty'].impl) as XRTTty;
    // const addon = tty.addon;
    this.tty.term.onRender(() => {
      // update fbo
      this.invalidated = true;
    });

    // ws to node-pty
    const protocol = (location.protocol == "https:") ? "wss" : "ws";
    const url = `${protocol}://${location.hostname}`;
    const socket = new WebSocket(`${url}:${CM.COMM_PORT}/`);
    // Listen on data, write it to the terminal
    socket.onmessage = ({ data }) => {
      // console.log(data);
      this.tty.term.write(data);
    };
    socket.onclose = () => {
      this.tty.term.write('\r\nConnection closed.\r\n');
    };
    this.tty.term.onData((data: string) => {
      // console.log(`onData: ${data}`)
      socket.send(data);
    });
  }

  beginFrame(w: number, h: number): [THREE.Texture, number, number] | null {
    this.threeRenderer.resetState();
    // let w = this.outer.Rect.width;
    // let h = this.outer.Rect.height;
    // if (w == 0 || h == 0) {
    //   return;
    // }
    //
    // const dpr = window.devicePixelRatio;
    // w *= dpr;
    // h *= dpr;
    //
    this.previousFrameBuffer = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING);

    const [fbo, texture] = this.fbo.getOrCreate(w, h, this.threeRenderer);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);

    return [texture, w, h];
  }

  endFrame(texture: THREE.Texture) {
    this.threeRenderer.resetState();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.previousFrameBuffer);
    // if (texture) {
    //   // console.log('endFrame');
    //   this.outer.Update(this.state.CursorScreen, texture);
    //   this.state._renderer.render(this.outer.Scene, this.outer.Camera);
    //   this.state._renderer.resetState();
    // this._gl.bindTexture(this._gl.TEXTURE_2D, null);
    // }
  }

  tick(component: typeof AFRAME.AComponent) {
    // this.tty.term.write(`${this.count++}\n`);
    // this.termObject._aframebuffergeometry.attributes.position.needsUpdate = true;
    // this.termObject._aframebuffergeometry.attributes.uv.needsUpdate = true;
    if (this.invalidated) {
      console.log('fbo');
      this.invalidated = false;

      const f = 600
      const widthMeter = component.el.getAttribute('width')
      const heightMeter = component.el.getAttribute('height')
      const width = widthMeter * f;
      const height = heightMeter * f;
      const [texture, w, h] = this.beginFrame(width, height)
      this.gl.viewport(0, 0, w, h);
      this.tty.addon._renderer.render();
      this.endFrame(texture);
      if (this.material.map != texture) {
        this.material.map = texture;
        this.material.needsUpdate = true;
      }
    }
  }
}

console.log('AFRAME.registerComponent', 'term-bare');
AFRAME.registerComponent('term-bare', {
  dependencies: ['xrtty'],
  schema: {
    width: { default: 1 },
    height: { default: 0.6 },
    depth: { default: 0.03 },
    color: { default: '#ffffff' },
    background: { default: '#000000' }
  },

  /**
  * @this {AFRAME.AComponent & {impl: XRTTermBare}}
  */
  init: function() {
    // @ts-ignore
    this.impl = new XRTTermBare(this);
  },
  tick() {
    // @ts-ignore
    this.impl.tick(this);
  }
});
