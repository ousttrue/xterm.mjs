import * as THREE from "three";

export default class State {
  public _renderer: THREE.WebGLRenderer;
  private _observer?: ResizeObserver;
  public CursorScreen = new THREE.Vector4(0, 0, 0, 0);
  mouse0 = false;
  mouse1 = false;

  constructor(canvas: HTMLCanvasElement, context: WebGL2RenderingContext,
    on0: (arg0: number, arg1: number) => void,
    on1: (arg0: number, arg1: number) => void) {
    this._renderer = new THREE.WebGLRenderer({ canvas, context });
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._observeSize(canvas);
    window.addEventListener('mousedown', e => {
      switch (e.button) {
        case 0:
          this.mouse0 = true;
          break;
        case 1:
          this.mouse1 = true;
          break;
      }
    });
    this._renderer.domElement.addEventListener('mouseup', e => {
      switch (e.button) {
        case 0:
          this.mouse0 = false;
          break;
        case 1:
          this.mouse1 = false;
          break;
      }
    });
    this._renderer.domElement.addEventListener('mousemove', e => {
      const dx = e.clientX - this.CursorScreen.x;
      const dy = e.clientY - this.CursorScreen.y;
      if (this.mouse0) {
        on0(dx, dy);
      }
      if (this.mouse1) {
        on1(dx, dy);
      }
      this.CursorScreen.x = e.clientX;
      this.CursorScreen.y = e.clientY;
    });
  }

  _observeSize(el: HTMLElement) {
    this._observer = new ResizeObserver((entries) => {
      const entry = entries.find((entry) => entry.target === el);
      if (!entry) {
        return;
      }

      // Fire the callback, ignore events where the dimensions are 0x0 as the canvas is likely hidden
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      if (width > 0 && height > 0) {
        this._onResize(width, height);
      }
    });
    try {
      this._observer.observe(el);
    } catch {
      this._observer.disconnect();
    }
  }

  _onResize(width: number, height: number) {
    if (width == this.CursorScreen.width
      && height == this.CursorScreen.height) {
      return;
    }
    this.CursorScreen.width = width;
    this.CursorScreen.height = height;
    console.log(width, height);
    this._renderer.setSize(width, height);
  }
}
