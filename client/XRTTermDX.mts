// @ts-check
import CM from '../../Common.mjs';
import AFRAME from 'aframe'

/*
 * based on aframe-xterm-component by rangermauve
 * MIT license
 */

export default class XRTTermDX {
  constructor() {
  }

  init(self_) {
    const message = 'Initialized\r\n';
    const tty = self_.el.components['xrtty'];

    console.log(self_.data.position);

    tty.write(message);

    const socket = new WebSocket('ws://localhost:' + String(CM.COMM_PORT) + '/');

    // Listen on data, write it to the terminal
    socket.onmessage = ({ data }) => { tty.write(data); };
    socket.onclose = () => { tty.write('\r\nConnection closed.\r\n'); };

    // Listen on user input, send it to the connection
    self_.el.addEventListener('xrtty-data', ({ detail }) => { socket.send(detail); });

    // console.log({WebglAddon});
    // const webgladdon = {WebglAddon};
    // tty.term.loadAddon(webgladdon);
  }

  get_dragging_type() {
    return CM.WS_PLACEMENT.CYLINDER;
  }
}

console.log('AFRAME.registerComponent', 'term-dx')
AFRAME.registerComponent('term-dx', {
  dependencies: ['xrtty'],
  /*
  schema: Object.assign({
    cols: {
      type: 'number',
      default: 80
    },
    rows: {
      type: 'number',
      default: 25
    },
  }, TERMINAL_THEME), */
  schema: {
    radius: { type: 'string', default: '4' },
    height: { type: 'string', default: '5' },
    rotation: { type: 'string', default: '0 0 0' },
    position: { type: 'string', default: '0 0 0' }
  },
  init: function() {
    this.impl = new XRTTermDX(this);
  }
});

