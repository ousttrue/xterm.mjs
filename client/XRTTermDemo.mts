// @ts-check
/// <reference path="../../demo/lib/local-echo.min.js">
/// <reference path="../../demo/lib/bash-emulator.min.js">
import TermObject from './TermObject.mjs'
import CM from '../Common.mjs'
import XRTTty from './XRTTty.mjs'

function init_bash_emulator_() {
  const emulator = bashEmulator({
    workingDirectory: '/',
    fileSystem: {
      '/': {
        type: 'dir',
        modified: Date.now()
      },
      '/README.txt': {
        type: 'file',
        modified: Date.now(),
        content: 'empty'
      },
      '/home': {
        type: 'dir',
        modified: Date.now()
      },
      '/home/user/journal.txt': {
        type: 'file',
        modified: Date.now(),
        content: 'this is private!'
      },
      '/home/user': {
        type: 'dir',
        modified: Date.now()
      }
    }
  });

  return emulator;
}

export default class XRTTermDemo {
  termObject: TermObject;

  constructor(component: typeof AFRAME.AComponent) {
    // @ts-ignore
    const tty = (component.el.components['xrtty'].impl) as XRTTty;
    const aframeaddon = tty.aframeaddon;
    this.termObject = new TermObject(aframeaddon.Renderer, component.data);
    component.el.setObject3D('mesh', this.termObject.bg_mesh);
    component.el.appendChild(this.termObject.glyph_el);
    tty.term.onRender(() => {
      // TODO: when atlas updated
      this.termObject.glyph_texture.needsUpdate = true;
    });

    // bash
    const bash = init_bash_emulator_();

    tty.term.onData((data: string) => {
      this.interaction_(tty, data);
    });

    const localEcho = new LocalEchoController();
    tty.term.loadAddon(localEcho);
    localEcho.addAutocompleteHandler((index, tokens) => {
      if (index == 0) { return Object.keys(bash.commands); }
      return [];
    });

    tty.term.write(CM.DEMO_BANNER);
    this.repl_(localEcho, bash, tty);
  }

  repl_(echo: LocalEchoController, bash: any, tty: XRTTty) {
    echo.read(CM.DEMO_PROMPT, CM.DEMO_CONTINUOUS_PROMPT)
      .then(input => bash.run(input).then(
        (log_) => {
          tty.write(log_);
          tty.write('\r\n');
          this.repl_(echo, bash, tty);
        },
        (error_) => {
          tty.write(error_);
          tty.write('\r\n');
          this.repl_(echo, bash, tty);
        }))
      .catch(error => console.log(`Error reading: ${error}`));
  }

  interaction_(tty: XRTTty, event_: any) {
    const command = CM.key_to_cmd_term(event_.detail);
    const rows = tty.term.rows;
    const cols = tty.term.cols;
    // const pos_wld = new THREE.Vector3();
    // self_.el.object3D.getWorldPosition(pos_wld);
    //
    console.log(command, ': ', tty.el.id);
    //
    // switch (command) {
    //   case CM.WS_CMD.MOVE_UP:
    //     pos_wld.y += 1.0;
    //     break;
    //   case CM.WS_CMD.MOVE_DOWN:
    //     pos_wld.y -= 1.0;
    //     break;
    //   case CM.WS_CMD.MOVE_LEFT:
    //     pos_wld.x -= 1.0;
    //     break;
    //   case CM.WS_CMD.MOVE_RIGHT:
    //     pos_wld.x += 1.0;
    //     break;
    //
    //   case CM.WS_CMD.RESIZE_UP:
    //     rows += 1;
    //     break;
    //   case CM.WS_CMD.RESIZE_DOWN:
    //     rows -= 1;
    //     break;
    //   case CM.WS_CMD.RESIZE_LEFT:
    //     cols -= 1;
    //     break;
    //   case CM.WS_CMD.RESIZE_RIGHT:
    //     cols += 1;
    //     break;
    //
    //   default: break;
    // }
    // self_.el.setAttribute('animation', "property: position; to:"
    //   + pos_wld.x.toString() + " " + pos_wld.y.toString() + " " + pos_wld.z.toString()
    //   + "; dur: 200; easing: easeOutExpo; loop: false");
    // animation="property: position; to: 1 8 -10; dur: 2000; easing: linear; loop: true"
    // tty.term.resize(rows, cols);
  }
}


console.log('AFRAME.registerComponent', 'term-demo')
AFRAME.registerComponent('term-demo', {
  dependencies: ['xrtty'],
  schema: {
    width: { default: 1 },
    height: { default: 0.6 },
    depth: { default: 0.05 },
    color: { default: '#ffffff' },
    background: { default: '#000000' }
  },
  init: function() {
    // @ts-ignore
    this.impl = new XRTTermDemo(this);
  },
});

