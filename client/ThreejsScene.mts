import RectTarget from './recttarget.mts';
import State from './state.mts'
import Fbo from "./fbo.mjs";

export default class ThreejsScene {
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
