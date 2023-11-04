// @ts-check
import CM from '../../Common.mjs';
import AFRAME from 'aframe'
import XRTTty from './XRTTty.mjs';

/*
 * based on aframe-xterm-component by rangermauve
 * MIT license
 */

export default class XRTTermBase {
  /**
  * @param {AFRAME.AComponent} self_
  */
  constructor(self_) {

    const message = 'Initialized\r\n';
    // @ts-ignore
    const tty = /** @type {XRTTty} */ (self_.el.components['xrtty'].impl);

    tty.term.write(message);

    const socket = new WebSocket('ws://localhost:' + String(CM.COMM_PORT) + '/');

    // Listen on data, write it to the terminal
    socket.onmessage = ({ data }) => { tty.term.write(data); };
    socket.onclose = () => { tty.term.write('\r\nConnection closed.\r\n'); };

    // Listen on user input, send it to the connection
    self_.el.addEventListener('xrtty-data', ({ detail }) => { socket.send(detail); });
  }

  get_dragging_type() {
    return CM.WS_PLACEMENT.PLANE;
  }
}

console.log('AFRAME.registerComponent', 'term-base')
AFRAME.registerComponent('term-base', {
  dependencies: ['xrtty'],
  schema: {
    event: { type: 'string', default: '' },
    message: { type: 'string', default: 'Hello, World!' }
  },
  init: function() {
    this.term = new XRTTermBase(this);
  }
});

