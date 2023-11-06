/// @ts-check
import CM from '../Common.mjs'
import XRTTty from './XRTTty.mts';
import Fbo from './fbo.mjs';

export default class XRTTermBare {
  threeRenderer: THREE.Renderer;
  fbo: Fbo;
  gl: WebGL2RenderingContext;
  tty: XRTTty;
  previousFrameBuffer: any;
  material: any;
  count = 0;

  constructor(component: typeof AFRAME.AComponent) {
    this.threeRenderer = document.querySelector('a-scene')!.renderer;
    this.material = new THREE.MeshBasicMaterial({});
    this.material.needsUpdate = true;
    component.el.object3D.children[0].material = this.material;

    // @ts-ignore
    this.gl = this.threeRenderer.getContext();
    this.fbo = new Fbo(this.gl);

    // @ts-ignore
    this.tty = (component.el.components['xrtty'].impl) as XRTTty;

    // ws to node-pty
    const protocol = (location.protocol == "https:") ? "wss" : "ws";
    const url = `${protocol}://${location.hostname}`;
    const socket = new WebSocket(`${url}:${CM.COMM_PORT}/`);
    // Listen on data, write it to the terminal
    socket.onmessage = ({ data }) => {
      this.tty.term.write(data);
      this.tty.addon._renderer!.renderRows(0, this.tty.term._core.rows - 1);
    };
    socket.onclose = () => {
      this.tty.term.write('\r\nConnection closed.\r\n');
      this.tty.addon._renderer!.renderRows(0, this.tty.term._core.rows - 1);
    };
    this.tty.term.onData((data: string) => {
      console.log(data)
      socket.send(data);
    });
  }

  beginFrame(w: number, h: number): [THREE.Texture, number, number] | null {
    this.threeRenderer.resetState();

    const dpr = window.devicePixelRatio;
    w *= dpr;
    h *= dpr;

    this.previousFrameBuffer = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING);

    const [fbo, texture] = this.fbo.getOrCreate(w, h, this.threeRenderer);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);

    return [texture, w, h];
  }

  endFrame(texture: THREE.Texture) {
    this.threeRenderer.resetState();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.previousFrameBuffer);
  }

  tick(component: typeof AFRAME.AComponent) {
    if (this.tty.addon._renderer._invalidated) {
      console.log('fbo');
      this.tty.addon._renderer._invalidated = false;

      const cell = this.tty.addon._renderer!.dimensions.device.cell;
      const cols = this.tty.term.cols;
      const rows = this.tty.term.rows;
      const ww = cols * cell.width
      const hh = rows * cell.height;
      this.gl.viewport(0, 0,
        ww,
        hh
      );
      const [texture, w, h] = this.beginFrame(ww, hh)

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
