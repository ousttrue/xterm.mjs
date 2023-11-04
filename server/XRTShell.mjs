// @ts-check
import https from 'https'
import fs from 'fs';
import os from 'os';

import WebSocket, { WebSocketServer } from 'ws';
import express from 'express'
import expressWs from 'express-ws'
import pty from 'node-pty';

import CM from '../Common.mjs';

let host = '0.0.0.0'
if (process.argv.length > 2) {
  host = process.argv[2];
}
const PORT = CM.COMM_PORT
const KEY = 'localhost-key.pem'
const PEM = 'localhost.pem'

const SHELL = os.platform() === "win32" ? 'cmd.exe' : '/usr/bin/bash';

/**
 * @param {WebSocket} connection
 */
function onConnection(connection) {
  const env = {
    name: 'vt100',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env
  };
  console.log(`launch: ${SHELL}`)
  const ptyProcess = pty.spawn(SHELL, [], env);

  ptyProcess.onData((data) => {
    connection.send(data);
  });
  ptyProcess.onExit(() => {
    console.log('pty.exit');
    connection.close();
  });

  connection.on('message', (message, isBinary) => {
    // @ts-ignore
    ptyProcess.write(isBinary ? message.toString() : message);
  });
  connection.on('close', () => {
    console.log('ws.close');
    ptyProcess.kill();
  });
}

const _app = express();
const server = https.createServer({
  key: fs.readFileSync(KEY),
  cert: fs.readFileSync(PEM),
}, _app)
const appWs = expressWs(_app, server);
// const wss = appWs.getWss('/');

appWs.app.ws('/', (
    /** @type {WebSocket} */ ws,
    /** @type {any} */ _req
) => {
  // console.log(ws);
  onConnection(ws);
});
appWs.app.use(express.static('.'))
server.listen(PORT, host, () => console.log(`https://${host}:${PORT}`))

