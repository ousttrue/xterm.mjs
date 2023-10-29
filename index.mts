import { Terminal as TerminalCore } from "./src/browser/Terminal.mts";
import { WebglExternalAddon } from "./addons/xterm-addon-webgl/src/WebglExternalAddon.mts";
import { BufferNamespaceApi } from './src/common/public/BufferNamespaceApi.mts';
import RectTarget from './recttarget.mts';
import SceneTarget from './scenetarget.mts';
import State from './state.mts'

document.addEventListener("DOMContentLoaded", (event) => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl2', {
  });
  console.log(gl);
  console.log(canvas);

  const inner = new SceneTarget();
  const outer = new RectTarget();
  outer.Load(inner.Target?.texture);

  const state = new State(canvas, gl,
    (dx, dy) => {
      outer.Rect.x += dx;
      outer.Rect.y += dy;
    },
    (dx, dy) => {
      outer.Rect.width += dx;
      outer.Rect.height += dy;
    });

  const term = new TerminalCore();
  if (term.open) {
    const el = document.getElementById("terminal");
    if (el) {
      term.open(el);
    }
  }

  const buffer = new BufferNamespaceApi(term);
  const addon = new WebglExternalAddon(gl);
  addon.activateCore(term, buffer, gl);
  term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");

  function animate() {
    requestAnimationFrame(animate);

    inner.Update(outer.Rect.width, outer.Rect.height);
    outer.Update(state.CursorScreen);

    // render to fbo
    state._renderer.setRenderTarget(inner.Target);
    // state._renderer.render(inner.Scene, inner.Camera);
    addon._renderer.render(inner.Target.width, inner.Target.height);

    // render to canvas
    state._renderer.setRenderTarget(outer.Target);
    state._renderer.render(outer.Scene, outer.Camera);
  }
  animate();
});

