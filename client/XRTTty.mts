// @ts-check
import { Terminal } from '../src/browser/public/Terminal.mjs';
import { WebglExternalAddon } from '../addons/xterm-addon-webgl/src/WebglExternalAddon.mjs';

/*
 * based on aframe-xterm-component by rangermauve
 * MIT license
 */

import CM from '../Common.mjs';
const TERMINAL_THEME = {
  theme_foreground: { 'default': '#ffffff' },
  theme_background: { 'default': '#000000' },
  theme_cursor: { 'default': '#ffffff' },
  theme_selection: { 'default': 'rgba(255, 255, 255, 0.3)' },
  theme_black: { 'default': '#000000' },
  theme_red: { 'default': '#e06c75' },
  theme_brightRed: { 'default': '#e06c75' },
  theme_green: { 'default': '#A4EFA1' },
  theme_brightGreen: { 'default': '#A4EFA1' },
  theme_brightYellow: { 'default': '#EDDC96' },
  theme_yellow: { 'default': '#EDDC96' },
  theme_magenta: { 'default': '#e39ef7' },
  theme_brightMagenta: { 'default': '#e39ef7' },
  theme_cyan: { 'default': '#5fcbd8' },
  theme_brightBlue: { 'default': '#5fcbd8' },
  theme_brightCyan: { 'default': '#5fcbd8' },
  theme_blue: { 'default': '#5fcbd8' },
  theme_white: { 'default': '#d0d0d0' },
  theme_brightBlack: { 'default': '#808080' },
  theme_brightWhite: { 'default': '#ffffff' }
};

export default class XRTTty {
  terminalElement: HTMLElement;
  term: Terminal;
  addon: WebglExternalAddon;

  constructor(component: typeof AFRAME.AComponent) {
    console.log('new tty');
    this.terminalElement = document.createElement('div');
    this.terminalElement.setAttribute('style',
      `width: 1024px; height: 1024px; opacity: 0.0; overflow: hidden;`);
    component.el.appendChild(this.terminalElement);

    // Build up a theme object
    const theme = Object.keys(component.data).reduce((theme, key) => {
      if (!key.startsWith('theme_')) {
        return theme;
      }
      const data = component.data[key];
      if (!data) {
        return theme;
      }
      // @ts-ignore
      theme[key.slice('theme_'.length)] = data;
      return theme;
    }, {});

    this.term = new Terminal({
      theme: theme,
      allowTransparency: false,
      cursorBlink: true,
      disableStdin: false,
      rows: component.data.rows,
      cols: component.data.cols,
      fontSize: 24
    });
    console.log(component.data);

    this.term.open(this.terminalElement);

    // @ts-ignore
    const gl = document.querySelector('a-scene').renderer.getContext();
    this.addon = new WebglExternalAddon(gl);
    this.term.loadAddon(this.addon);

    const message = 'Initialized\r\n';
    this.term.write(message);
  }
}

console.log('AFRAME.registerComponent', 'xrtty')
AFRAME.registerComponent('xrtty', {
  schema: Object.assign({
    cols: {
      type: 'number',
      default: 40
    },
    rows: {
      type: 'number',
      default: 20
    },
  }, TERMINAL_THEME),
  init: function() {
    // @ts-ignore
    this.impl = new XRTTty(this);

    // event listener
    this.el.addEventListener('click', () => {
      // @ts-ignore
      this.impl.term.focus();
      console.log('focused on ', this);
    });
    this.el.addEventListener('raycaster-intersected', () => {
      // @ts-ignore
      this.impl.term.focus();
      console.log('intersected');
    });
    this.el.addEventListener('raycaster-cleared', () => {
      console.log('cleared');
    });
  },
});
